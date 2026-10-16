import { RepoBinding } from './types';

export function buildRemoteRebuildChecklist(repo: RepoBinding, lastRemoteSha: string): string {
  return [
    '远程重建准备清单（只读，不执行删除或重建）',
    `仓库：${repo.owner}/${repo.name}`,
    `可见性：${repo.private ? '私有' : '公开（本流程不适用）'}`,
    `默认分支：${repo.branch}`,
    `最近记录 SHA：${lastRemoteSha || '尚未记录'}`,
    '',
    '在另行明确确认前，必须完成：',
    '1. 完整冷备份（含 .git），并核对文件数、目录数与字节数。',
    '2. 媒体转换、链接重写和优化历史提交均已完成并审阅。',
    '3. 另一台设备暂停同步，避免重建期间推送污染。',
    '4. 核对 star、issue、wiki 和 LFS 历史将永久丢失。',
    '5. 最后单独确认目标仓库及影响范围后，才考虑删除并重建。',
    '',
    '本入口只显示准备信息，不调用删除或重建接口。'
  ].join('\n');
}

export interface RemoteRebuildPreflight {
  repo: RepoBinding;
  localSha: string;
  remoteSha: string;
  hasIssues: boolean;
  hasWiki: boolean;
  stars: number;
  uncommittedChanges: number;
  bundlePath: string;
}

export interface RemoteRebuildConfirmation {
  repository: string;
  coldBackupAndCurrentHistoryConfirmed: boolean;
  secondDevicePausedConfirmed: boolean;
  historyLossConfirmed: boolean;
}

export interface RemoteRebuildOperations {
  deleteRemote(): Promise<void>;
  assertRemoteDeleted(): Promise<void>;
  recreateRemote(hasIssues: boolean, hasWiki: boolean): Promise<void>;
  forcePush(): Promise<void>;
  readRemoteSha(): Promise<string | null>;
}

export type RemoteRebuildStage = 'preflight' | 'delete' | 'recreate' | 'push' | 'verify';

export class RemoteRebuildStageError extends Error {
  constructor(readonly stage: RemoteRebuildStage, message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RemoteRebuildStageError';
  }
}

export interface RemoteRebuildResult {
  stage: 'completed';
  localSha: string;
  remoteSha: string;
  bundlePath: string;
}

export function remoteRebuildConfirmationError(
  preflight: RemoteRebuildPreflight,
  confirmation: RemoteRebuildConfirmation
): string | null {
  if (!preflight.repo.private) return '只能删库同名重建私有仓库。';
  if (!preflight.localSha) return '本地没有可推送的提交。';
  if (!preflight.bundlePath) return '必须先创建并验证本地 Git bundle。';
  if (confirmation.repository.trim() !== `${preflight.repo.owner}/${preflight.repo.name}`) {
    return '输入的仓库与当前绑定不一致；请精确输入 owner/repo。';
  }
  if (!confirmation.coldBackupAndCurrentHistoryConfirmed) {
    return '必须确认完整冷备份已完成，并且当前本地历史就是要保留的版本。';
  }
  if (!confirmation.secondDevicePausedConfirmed) return '必须确认另一台设备已暂停同步。';
  if (!confirmation.historyLossConfirmed) return '必须确认原 Git 与 LFS 历史将永久丢失。';
  return null;
}

function stageError(stage: RemoteRebuildStage, error: unknown): RemoteRebuildStageError {
  const detail = error instanceof Error ? `：${error.message}` : `：${String(error)}`;
  const messages: Record<RemoteRebuildStage, string> = {
    preflight: '预检未通过',
    delete: '删除或删除后 404 核验失败；请先核对当前状态，不要自动重试删除',
    recreate: '同名重建失败；原仓库已删除，请处理当前空仓库，不要再次删除',
    push: '优化历史推送失败；同名仓库已重建，请只重试推送或从 bundle 恢复，不要再次删除',
    verify: '推送后远端 SHA 与本地不一致；请检查当前仓库，不要再次删除'
  };
  return new RemoteRebuildStageError(stage, `${messages[stage]}${detail}`, error);
}

export async function executeRemoteRebuild(
  preflight: RemoteRebuildPreflight,
  confirmation: RemoteRebuildConfirmation,
  operations: RemoteRebuildOperations
): Promise<RemoteRebuildResult> {
  const confirmationError = remoteRebuildConfirmationError(preflight, confirmation);
  if (confirmationError) throw new RemoteRebuildStageError('preflight', confirmationError);
  try {
    await operations.deleteRemote();
    await operations.assertRemoteDeleted();
  } catch (error) {
    throw stageError('delete', error);
  }
  try {
    await operations.recreateRemote(preflight.hasIssues, preflight.hasWiki);
  } catch (error) {
    throw stageError('recreate', error);
  }
  try {
    await operations.forcePush();
  } catch (error) {
    throw stageError('push', error);
  }
  let remoteSha: string | null;
  try {
    remoteSha = await operations.readRemoteSha();
  } catch (error) {
    throw stageError('verify', error);
  }
  if (remoteSha !== preflight.localSha) {
    throw new RemoteRebuildStageError('verify', `推送后远端 SHA 与本地不一致：${remoteSha || '未记录'} ≠ ${preflight.localSha}`);
  }
  return { stage: 'completed', localSha: preflight.localSha, remoteSha, bundlePath: preflight.bundlePath };
}
