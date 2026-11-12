# GitHub Vault Sync v0.2.1 — Confirmed Windows filename repair

> **2026-11-12 · v0.2.1 release.** One installable ZIP for desktop Obsidian; preserve local settings when upgrading. Native Windows Obsidian GUI acceptance remains deferred and is not claimed as passed. See the [validation record](VALIDATION_v0.2.1.md).

## 中文

v0.2.1 保留 v0.2.0 的“先预览、再确认同步”和跨平台安全校验，并加入**需用户确认的 Windows 不兼容文件名修复流程**，避免为安全同步手工重命名后仍反复遇到同类阻断。

### 新增与改进

- 当同步预览检测到 `?`、`:`、`"`、`|` 等 Windows 禁止文件名时，插件不再只显示错误；它提供「修复并重新预览」确认弹窗。
- 修复使用 Obsidian `fileManager.renameFile`，由 Obsidian 更新笔记和附件链接；不绕过编辑器直接改文件系统。
- 执行前会拒绝空操作、重复目标及已存在目标；执行后重新扫描，只有路径、大小写冲突和嵌套 Git 检查全部通过才会继续生成预览。
- 每次已完成的重命名都会写入本机 `github-vault-sync-backups/path-repairs/` 下的恢复日志；失败时自动反向恢复已完成项，并报告日志位置。
- 修复只修改本机文件名和链接，不提交、不上传、不合并。随后仍会显示独立的「同步前确认」。

### 安全边界

跨平台路径校验仍然保留。v0.2.1 不会允许 Windows 禁止路径进入 Git，也不会在后台自动改名。用户取消修复时，插件不修改任何笔记；用户批准修复后，也仍需在同步前确认中选择方向和上传。

### 验证状态

- 本机 TypeScript 检查、24 个测试文件／103 项测试和生产构建通过；新增文件名转换与冲突规划回归测试。
- macOS Obsidian 1.15.0 宿主验收覆盖插件加载、修复确认弹窗、Obsidian 重命名、链接检查、远端只读检查与同步前确认。
- Windows CI 不等于 Windows 原生 Obsidian GUI；本版原生 Windows GUI 验收继续延期。

### 安装／升级

下载本次 Release 唯一的手动附件 `github-vault-sync-0.2.1.zip`，不要使用自动生成的 Source code ZIP。保存笔记、备份 Vault 后正常退出 Obsidian；只替换 `.obsidian/plugins/github-vault-sync/` 中的三个运行文件，**保留现有本机 `data.json`**。详细步骤见[独立中文指南](install/README.zh-CN.md)，ZIP 也附有同一份中英说明。

## English

v0.2.1 keeps the v0.2.0 preview-first sync and cross-platform path validation, and adds a **confirmation-gated repair flow for Windows-incompatible filenames** so users no longer need to rename notes manually after the preview is blocked.

### New and improved

- When a preview detects `?`, `:`, `"`, `|` or another Windows-forbidden filename, the plugin now offers a **Repair and preview again** confirmation instead of only reporting the error.
- Repairs use Obsidian's `fileManager.renameFile`, so notes and attachment links are updated by Obsidian rather than by direct filesystem edits.
- No-op, duplicate and already-existing targets are rejected before changes. A post-repair scan must pass path, case-collision and nested-Git checks before preview generation continues.
- Completed renames are written to a local rollback log under `github-vault-sync-backups/path-repairs/`; failures restore completed renames and report the log location.
- Repair changes only local filenames and links. It never commits, uploads or merges; a separate **Sync preview confirmation** still follows.

### Safety boundaries

The cross-platform path validation remains in place. v0.2.1 never stages Windows-forbidden paths and never renames in the background. Cancelling the repair leaves notes untouched; after an approved repair, sync still requires the usual preview and confirmation.

### Validation status

- Local TypeScript checks, 24 test files / 103 tests and the production build passed; new regression tests cover filename conversion and repair planning.
- macOS Obsidian 1.15.0 host acceptance covered plugin loading, the repair confirmation dialog, Obsidian renaming, link checks, read-only remote checking and the sync preview.
- Windows CI is not native Windows Obsidian GUI acceptance; native Windows GUI validation remains deferred.

### Installation / upgrade

Download the single manual asset `github-vault-sync-0.2.1.zip`, not GitHub's automatic Source code archive. Save notes, back up the vault and exit Obsidian normally. Replace only the three runtime files in `.obsidian/plugins/github-vault-sync/` and **keep the existing local `data.json`**. The ZIP includes the same [standalone English guide](install/README.md) and its Chinese counterpart.
