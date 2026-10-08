import { requestUrl } from 'obsidian';
import { GithubVaultSyncSettings, RepoBinding } from './types';
import { sleep } from './utils';

const API_ROOT = 'https://api.github.com';
const WEB_ROOT = 'https://github.com';

export interface GithubUser {
  login: string;
  name?: string | null;
  email?: string | null;
}

export interface GithubRepository {
  name: string;
  full_name: string;
  private: boolean;
  clone_url: string;
  default_branch: string;
  permissions?: { admin?: boolean; push?: boolean; pull?: boolean };
  owner: { login: string };
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

export class GithubApiError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(message: string, status: number, responseBody = '') {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class GithubClient {
  constructor(private readonly settings: GithubVaultSyncSettings) {}

  private get token(): string {
    if (!this.settings.token) throw new Error('GitHub is not authenticated');
    return this.settings.token;
  }

  private async request<T>(pathOrUrl: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_ROOT}${pathOrUrl}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'GitHub-Vault-Sync/0.1.0'
    };
    if (options.auth !== false) headers.Authorization = `Bearer ${this.token}`;
    let body: string | undefined;
    if (options.body !== undefined) {
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }
    const response = await requestUrl({
      url,
      method: options.method ?? 'GET',
      headers,
      body,
      throw: false
    });
    const text = response.text ?? '';
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Keep plain text responses as-is.
      }
    }
    if (response.status >= 400) {
      const message = typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `GitHub request failed with HTTP ${response.status}`;
      throw new GithubApiError(message, response.status, text);
    }
    return parsed as T;
  }

  async getAuthenticatedUser(): Promise<GithubUser> {
    return this.request<GithubUser>('/user');
  }

  async startDeviceFlow(clientId: string): Promise<DeviceCodeResponse> {
    if (!clientId.trim()) throw new Error('OAuth client ID is not configured');
    const response = await requestUrl({
      url: `${WEB_ROOT}/login/device/code`,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'GitHub-Vault-Sync/0.1.0'
      },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        scope: 'repo read:user offline_access'
      }).toString(),
      throw: false
    });
    const data = JSON.parse(response.text || '{}') as DeviceCodeResponse & { error?: string; error_description?: string };
    if (response.status >= 400 || data.error) {
      throw new GithubApiError(data.error_description ?? data.error ?? 'Unable to start GitHub device authorization', response.status, response.text);
    }
    return data;
  }

  async pollDeviceFlow(clientId: string, deviceCode: DeviceCodeResponse, onWaiting?: (seconds: number) => void): Promise<string> {
    const deadline = Date.now() + deviceCode.expires_in * 1000;
    let interval = Math.max(deviceCode.interval || 5, 5);
    while (Date.now() < deadline) {
      await sleep(interval * 1000);
      const response = await requestUrl({
        url: `${WEB_ROOT}/login/oauth/access_token`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'GitHub-Vault-Sync/0.1.0'
        },
        body: new URLSearchParams({ client_id: clientId.trim(), device_code: deviceCode.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }).toString(),
        throw: false
      });
      const data = JSON.parse(response.text || '{}') as AccessTokenResponse;
      if (data.access_token) return data.access_token;
      if (data.error === 'authorization_pending') {
        onWaiting?.(interval);
        continue;
      }
      if (data.error === 'slow_down') {
        interval += 5;
        onWaiting?.(interval);
        continue;
      }
      if (data.error === 'expired_token') throw new Error('GitHub device code expired');
      if (data.error === 'access_denied') throw new Error('GitHub authorization was denied');
      throw new GithubApiError(data.error_description ?? data.error ?? 'GitHub authorization failed', response.status, response.text);
    }
    throw new Error('GitHub device authorization timed out');
  }

  async validateToken(token: string): Promise<GithubUser> {
    const previous = this.settings.token;
    this.settings.token = token.trim();
    try {
      return await this.getAuthenticatedUser();
    } finally {
      this.settings.token = previous;
    }
  }

  async getRepository(owner: string, name: string): Promise<GithubRepository> {
    return this.request<GithubRepository>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  }

  async createPrivateRepository(name: string, description?: string): Promise<GithubRepository> {
    return this.request<GithubRepository>('/user/repos', {
      method: 'POST',
      body: {
        name: name.trim(),
        description: description?.trim() || 'Obsidian vault synchronized by GitHub Vault Sync',
        private: true,
        auto_init: false
      }
    });
  }

  async bindRepository(owner: string, name: string): Promise<RepoBinding> {
    const repo = await this.getRepository(owner, name);
    if (!repo.private) throw new Error('The selected repository must be private');
    if (repo.permissions && repo.permissions.pull === false) throw new Error('The GitHub token cannot read this repository');
    if (repo.permissions && repo.permissions.push === false) throw new Error('The GitHub token cannot write to this repository');
    return {
      owner: repo.owner?.login ?? owner,
      name: repo.name,
      branch: repo.default_branch || 'main',
      remoteUrl: repo.clone_url,
      private: repo.private
    };
  }
}
