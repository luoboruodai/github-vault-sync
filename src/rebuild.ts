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
