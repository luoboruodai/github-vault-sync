# GitHub Vault Sync v0.2.1 — Validation record

**Date:** 2026-11-12  
**Scope:** confirmed Windows filename repair, preview-first sync, release packaging and desktop-host loading.

## 中文

### 本次范围

v0.2.1 只改变“预览发现 Windows 不兼容路径后的处理”：保留原有阻断和跨平台规则，在用户点击「修复并重新预览」后才调用 Obsidian 重命名 API、更新链接、保存恢复日志并重新扫描。不会放宽 Git 暂存规则，不会在后台自动改名，也不会新增上传授权。

### 已执行验证

- TypeScript：`tsc --noEmit` 通过。
- 测试：24 个测试文件、103 项测试全部通过；新增 `path-repair` 回归测试覆盖禁用字符转换、尾部标点、保留设备名、重复目标和已存在目标。
- 构建：esbuild 生产构建通过。
- macOS Obsidian 1.15.0：插件加载、同步中心状态、修复确认弹窗、Obsidian 重命名、链接检查、远端只读检查和同步前确认均由真实宿主复核；验收中实际修复 1 个临时测试文件和 4 个并行任务新增的真实文件，回滚日志完整，随后删除临时文件。
- 发布包：固定白名单 ZIP、源码／构建字节一致性和独立中英安装指南由 `scripts/release_archive.py` 校验。

### 边界与限制

- 修复弹窗需要用户确认；插件不会自动改名。转换规则把 Windows 禁止字符替换为全角等价字符，但仍要求用户复核同步预览。
- 自动检查仍会提醒本地差异；它不会自动触发文件名修复或上传。
- Windows CI 可验证 TypeScript、测试、构建和打包一致性，不等于 Windows 原生 Obsidian GUI 验收；本版原生 Windows GUI 验收继续延期。
- 第二设备同步、加密恢复、企业代理和完整附件冲突仍依赖实际环境，不在本记录中声称全部通过。

## English

### Scope

v0.2.1 changes only what happens **after a preview reports Windows-incompatible paths**: the existing blocking rule and cross-platform policy remain, while an explicit **Repair and preview again** action calls Obsidian's rename API, updates links, writes a rollback log and rescans before preview generation. It does not loosen Git staging rules, rename files in the background or grant upload approval.

### Checks performed

- TypeScript: `tsc --noEmit` passed.
- Tests: 24 test files / 103 tests passed; new `path-repair` regression tests cover forbidden characters, trailing punctuation, reserved device names, duplicate targets and existing targets.
- Build: the esbuild production build passed.
- macOS Obsidian 1.15.0: real-host checks covered plugin loading, the repair confirmation dialog, Obsidian renaming, link checks, read-only remote checking and the sync preview; acceptance repaired 1 temporary test file and 4 newly generated real files, verified the rollback log and then removed the temporary file.
- Release archive: the fixed allowlist ZIP, source/build byte equality and standalone bilingual install guides are checked by `scripts/release_archive.py`.

### Boundaries and limits

- Repair requires confirmation; the plugin never renames automatically. The conversion uses full-width equivalents for Windows-forbidden characters, and the user must still review the sync preview.
- Automatic checks may continue to report local differences; they never start repair or upload.
- Windows CI can verify TypeScript, tests, builds and archive consistency, but it is not native Windows Obsidian GUI acceptance; that validation remains deferred.
- Second-device sync, encrypted restore, enterprise proxies and full multi-device attachment conflicts remain environment-dependent and are not claimed as fully validated.
