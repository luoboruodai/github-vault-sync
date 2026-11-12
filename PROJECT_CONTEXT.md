# Project context | 项目接手指南

[English](#english) · [简体中文](#简体中文)

This is a **public, sanitized handoff** for the plugin source repository, not a copy of local development notes. The private `PROJECT.md`, local `AGENTS.md`, raw conversations, user vaults, cached data, logs, credentials, backups, and unpublished engineering assets are deliberately excluded. Treat this file and the linked public sources as context, not authorization to operate on a user's vault or publish a new release.

## English

### Purpose and current baseline

GitHub Vault Sync is an Obsidian **desktop** plugin that synchronizes a vault to a **separate private GitHub repository** through local Git and Git LFS. Its design goal is multi-device continuity without silently deciding which device's notes win. The public plugin repository is **not** the destination for anyone's notes. v0.2.1 is the latest published software release in this handoff; later documentation commits do not make a new plugin release.

- Save edits, inspect a read-only preview, choose the direction or resolve individual conflicts, then explicitly confirm the operation. Periodic checks notify; they do not upload automatically.
- Ordinary vault files and configured attachments use Git/LFS. Sensitive plugin settings are excluded from plaintext commits; when encrypted settings sync is enabled, the private vault repository stores an AES-256-GCM encrypted bundle. The recovery key stays local and needs a separate safe backup.
- Media optimization introduced in v0.2.0 only **suggests** manual conversion commands. It does not convert, delete, relink, or upload media on its own. Remote repository delete-and-recreate is a separate destructive, confirmation-gated action; it is never part of routine sync.
- Windows filename repair introduced in v0.2.1 is also confirmation-gated: it converts forbidden characters to full-width equivalents through Obsidian's rename API, updates links, checks collisions and writes a rollback log before re-previewing.

### Where to work

| Task | Source of truth |
| --- | --- |
| Obsidian entry point, settings and confirmation UI | `src/main.ts`, `src/settings.ts`, `src/settings-tabs.ts` |
| Preview, selected-note scope and sync orchestration | `src/sync-preview.ts`, `src/current-note.ts`, `src/sync-engine.ts` |
| Local Git/LFS and GitHub API | `src/git.ts`, `src/github.ts`, `src/migration.ts` |
| Path rules, sensitive-content boundaries and encrypted recovery | `src/policy.ts`, `src/utils.ts`, `src/encrypted-bundle.ts` |
| Windows filename repair planning | `src/path-repair.ts` |
| Media suggestions and guarded remote rebuild | `src/media-scan.ts`, `src/rebuild.ts` |
| Tests, package and user-facing limits | `tests/`, `scripts/release_archive.py`, `docs/VALIDATION_v0.2.1.md` |

See [development history](docs/PROJECT_HISTORY.md) for the **edited public chronology**, [release notes](docs/RELEASE_NOTES_v0.2.1.md) for shipped changes, and [installation instructions](docs/install/README.md) for the currently published package. The three [UI-motion examples](README.md#ui-motion-tour-v013) contain representative sample data; they are not recordings of a real user vault.

### Reproduce and change safely

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

The build outputs an ignored root `main.js`. Run tests with **temporary/synthetic vaults and local bare Git repositories**, not a user's working vault. The release ZIP is allowlisted (`manifest.json`, `main.js`, `styles.css`, and two standalone install guides); `python scripts/release_archive.py verify` checks the existing v0.2.1 archive **against v0.2.1's original sources**. Once inputs change, do not re-label or overwrite that published ZIP or tag: prepare a new version and verify its own package, CI, and download.

### Known boundaries and useful next checks

- At the v0.2.1 release, TypeScript, 24 test files / 103 tests, the production build and selected macOS Obsidian 1.15.0 host interactions passed. **Native Windows Obsidian GUI acceptance was deferred**; Windows CI is not a GUI test. Refer to [validation details](docs/VALIDATION_v0.2.1.md) rather than transferring those results to a future commit.
- After an actual private-vault repository rebuild, another device must first back up its old clone, clone again, hydrate LFS objects, and verify its plugin binding and recovery key. Publishing the plugin does not perform this work.
- Further engineering candidates already described in [development history](docs/PROJECT_HISTORY.md#6-已知边界与后续开发建议) include checking that backups of conflicted LFS attachments contain hydrated data, and improving recovery ergonomics for simultaneous encrypted-settings changes. These are **not shipped promises**.
- Never commit local `data.json`, vault notes, credential material, full cache or logs, absolute home paths, company/customer artifacts, original conversation exports, screenshots of real data, or private design/source assets. A synthetic test fixture is not evidence that a real vault is safe to upload. Preserve the preview/confirmation, remote-change rejection, conflict backup and secret-exclusion tests when changing sync behavior.

## 简体中文

### 初衷与当前基线

GitHub Vault Sync 是用本机 Git/Git LFS 将 Obsidian **桌面端** Vault 同步至**单独的私有 GitHub 仓库**的插件。设计初衷是多设备持续使用，同时不替用户静默决定哪台设备的笔记优先。**公开插件源码仓库绝不是笔记数据仓库。** 本交接以已发布 v0.2.1 为软件基线；后续只改文档不产生新插件版本。

- 先保存修改、只读预览、选择方向或逐项处理冲突，最后明确确认；定时检查只提醒、不自动上传。
- 常规笔记及附件通过 Git/LFS；敏感插件配置不明文提交。启用加密配置同步后，私有 Vault 仓库只保存 AES-256-GCM 密文包，恢复密钥留在本机并须另做安全备份。
- v0.2.0 引入的媒体优化仅建议手动转换命令，不自动转换、删除、修改笔记链接或上传。远端删库同名重建为独立的高风险确认流程，不属于常规同步。
- v0.2.1 引入的 Windows 文件名修复同样需要用户确认：通过 Obsidian 重命名 API 修改文件并更新链接，检查重名并保存恢复日志，然后重新预览。

### 源码入口与验证

上方模块表适用于两种语言。阅读顺序：本交接 → [公开脱敏开发历程](docs/PROJECT_HISTORY.md) → [v0.2.1 验证范围](docs/VALIDATION_v0.2.1.md) → 对应源码和测试。安装与版本变化见[独立中文安装指南](docs/install/README.zh-CN.md)及[发布说明](docs/RELEASE_NOTES_v0.2.1.md)。README 中的界面动效是示意数据，并非真实笔记库录屏。

按上方四条命令完成依赖安装、类型检查、测试和构建。**只在合成测试库和临时本地 Git 裸仓库**验证；不要以真实工作 Vault 跑回归。根目录构建产物 `main.js` 被忽略。v0.2.1 ZIP 是固定白名单包，既有包的核验针对原发布输入；变更源码或安装说明后须另起版本，不覆盖旧 Tag／附件，也不要把旧 CI 结果当作新提交的验证。

### 后续开发边界

v0.2.1 已有类型检查、24 个文件／103 项测试、生产构建和部分 macOS Obsidian 1.15.0 宿主验收；**Windows 原生 Obsidian GUI 尚未验收**。真实私有仓库重建后的第二设备需先备份旧克隆、重新克隆、拉取 LFS，并核对绑定和恢复密钥；插件发布不能替代这一步。LFS 冲突附件备份是否已水合、两设备同时改动加密配置的恢复体验，是[历史文档](docs/PROJECT_HISTORY.md#6-已知边界与后续开发建议)中的候选方向，不是现有保证。

不要把本机 `PROJECT.md`、私有 `AGENTS.md`、Vault 笔记、`data.json`、缓存／日志、令牌／恢复密钥、本机绝对路径、公司及客户资料、原始聊天／真实截图或工程素材提交到公开仓库。修改同步流程时要保留预览确认、远端变化拒绝旧授权、冲突备份与明文敏感文件排除的测试。**阅读本文件不构成操作用户 Vault 或发布新版本的授权。**
