import { describe, expect, it } from 'vitest';
import { buildRemoteRebuildChecklist } from '../src/rebuild';
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
