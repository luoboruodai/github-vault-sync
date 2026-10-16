import { describe, expect, it } from 'vitest';
import { buildRemoteRebuildChecklist, executeRemoteRebuild, remoteRebuildConfirmationError,
  RemoteRebuildConfirmation, RemoteRebuildOperations, RemoteRebuildPreflight, RemoteRebuildStageError } from '../src/rebuild';
import { RepoBinding } from '../src/types';

describe('remote rebuild preparation', () => {
  it('shows the repository and required safeguards without executing a rebuild', () => {
    const repo: RepoBinding = {
      owner: 'example',
      name: 'private-vault',
      branch: 'main',
      remoteUrl: 'https://github.com/example/private-vault.git',
      private: true
    };
    const checklist = buildRemoteRebuildChecklist(repo, 'abc123');
    expect(checklist).toContain('example/private-vault');
    expect(checklist).toContain('私有');
    expect(checklist).toContain('默认分支：main');
    expect(checklist).toContain('最近记录 SHA：abc123');
    expect(checklist).toContain('完整冷备份');
    expect(checklist).toContain('媒体转换、链接重写和优化历史提交');
    expect(checklist).toContain('另一台设备暂停同步');
    expect(checklist).toContain('本入口只显示准备信息，不调用删除或重建接口。');
  });

  it('keeps an unrecorded SHA and public visibility explicit', () => {
    const checklist = buildRemoteRebuildChecklist({
      owner: 'example', name: 'public-vault', branch: 'dev', remoteUrl: '', private: false
    }, '');
    expect(checklist).toContain('公开（本流程不适用）');
    expect(checklist).toContain('最近记录 SHA：尚未记录');
  });
});

describe('remote rebuild execution', () => {
  const preflight: RemoteRebuildPreflight = {
    repo: { owner: 'example', name: 'private-vault', branch: 'main', remoteUrl: '', private: true },
    localSha: 'abc123',
    remoteSha: 'def456',
    hasIssues: true,
    hasWiki: false,
    stars: 0,
    uncommittedChanges: 3,
    bundlePath: '/tmp/backup.bundle'
  };
  const confirmation: RemoteRebuildConfirmation = {
    repository: 'example/private-vault',
    coldBackupAndCurrentHistoryConfirmed: true,
    secondDevicePausedConfirmed: true,
    historyLossConfirmed: true
  };

  it('requires the exact repository and every explicit confirmation', () => {
    expect(remoteRebuildConfirmationError(preflight, confirmation)).toBeNull();
    expect(remoteRebuildConfirmationError(preflight, { ...confirmation, repository: 'example/other' })).toContain('不一致');
    expect(remoteRebuildConfirmationError(preflight, { ...confirmation, coldBackupAndCurrentHistoryConfirmed: false })).toContain('冷备份');
    expect(remoteRebuildConfirmationError(preflight, { ...confirmation, secondDevicePausedConfirmed: false })).toContain('另一台设备');
    expect(remoteRebuildConfirmationError(preflight, { ...confirmation, historyLossConfirmed: false })).toContain('永久丢失');
  });

  it('deletes, verifies, recreates with the original settings, force-pushes and verifies the SHA in order', async () => {
    const calls: string[] = [];
    const operations: RemoteRebuildOperations = {
      deleteRemote: async () => { calls.push('delete'); },
      assertRemoteDeleted: async () => { calls.push('assert-deleted'); },
      recreateRemote: async (hasIssues, hasWiki) => { calls.push(`recreate:${hasIssues}:${hasWiki}`); },
      forcePush: async () => { calls.push('push'); },
      readRemoteSha: async () => { calls.push('read-sha'); return 'abc123'; }
    };
    const result = await executeRemoteRebuild(preflight, confirmation, operations);
    expect(result.stage).toBe('completed');
    expect(result.remoteSha).toBe('abc123');
    expect(calls).toEqual(['delete', 'assert-deleted', 'recreate:true:false', 'push', 'read-sha']);
  });

  it('stops after recreation failure without pushing or retrying deletion', async () => {
    const calls: string[] = [];
    const operations: RemoteRebuildOperations = {
      deleteRemote: async () => { calls.push('delete'); },
      assertRemoteDeleted: async () => { calls.push('assert-deleted'); },
      recreateRemote: async () => { calls.push('recreate'); throw new Error('API unavailable'); },
      forcePush: async () => { calls.push('push'); },
      readRemoteSha: async () => { calls.push('read-sha'); return null; }
    };
    await expect(executeRemoteRebuild(preflight, confirmation, operations)).rejects.toMatchObject({
      name: 'RemoteRebuildStageError', stage: 'recreate'
    });
    expect(calls).toEqual(['delete', 'assert-deleted', 'recreate']);
  });

  it('reports push failure as a distinct stage and never retries deletion', async () => {
    const calls: string[] = [];
    const operations: RemoteRebuildOperations = {
      deleteRemote: async () => { calls.push('delete'); },
      assertRemoteDeleted: async () => { calls.push('assert-deleted'); },
      recreateRemote: async () => { calls.push('recreate'); },
      forcePush: async () => { calls.push('push'); throw new Error('network down'); },
      readRemoteSha: async () => { calls.push('read-sha'); return null; }
    };
    await expect(executeRemoteRebuild(preflight, confirmation, operations)).rejects.toMatchObject({
      name: 'RemoteRebuildStageError', stage: 'push'
    });
    expect(calls).toEqual(['delete', 'assert-deleted', 'recreate', 'push']);
  });

  it('rejects a mismatched repository before any destructive operation', async () => {
    let called = false;
    const operations: RemoteRebuildOperations = {
      deleteRemote: async () => { called = true; },
      assertRemoteDeleted: async () => { called = true; },
      recreateRemote: async () => { called = true; },
      forcePush: async () => { called = true; },
      readRemoteSha: async () => { called = true; return null; }
    };
    await expect(executeRemoteRebuild(preflight, { ...confirmation, repository: 'example/other' }, operations))
      .rejects.toBeInstanceOf(RemoteRebuildStageError);
    expect(called).toBe(false);
  });
});
