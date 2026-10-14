# GitHub Vault Sync v0.1.3 — Second-device bootstrap and network resilience (unreleased)

> This is an unreleased source preview available on `main`. The public v0.1.2 Release and tag remain unchanged. See the [validation record](VALIDATION_v0.1.3.md) for completed checks and outstanding acceptance; source publication is not a v0.1.3 binary release.

## 中文

本版本针对第二台 Windows 设备从空 Vault 拉取私有仓库的部署记录进行修复，重点覆盖授权后绑定、加密恢复、Git LFS、网络代理、旧配置迁移和跨宿主 UI 差异。

### 已修复/改进

- 旧版或原型 `.github-vault-sync.json` / `data.json` 的排除规则会自动补齐当前安全必需规则；第三方插件 `data.json`、临时密文包、常见凭据文件不会因旧配置而恢复成明文同步。
- 第二设备导入恢复密钥后不会立即开启加密上传；必须先检查远端密文包并完成“解密并恢复”，避免空配置包覆盖主设备或两台设备因 PAT 不同发生密文摘要乒乓。
- 加密包摘要忽略设备私有身份字段（PAT、授权类型、OAuth Client ID、Git 代理），但密文本身仍可在用户明确选择“完整恢复本插件登录”时恢复；兼容 v0.1.2 的旧摘要格式。
- 远程优先克隆不再依赖 Git LFS 全局 smudge 状态：先以无 smudge 方式克隆，再执行本地 `git lfs install` 与 `git lfs pull`；无 Git LFS 时，如果远端确有 LFS 指针，会明确阻止继续而不是落下不可用的指针文件。
- 增加可选的仓库级 Git HTTP/SOCKS 代理设置，适合 GitHub API 可访问但 Git HTTPS 端点被网络重置的环境；代理只作为 Git 命令参数使用，不写进远端 URL。网络错误会给出代理/网络排查提示。
- 同步失败状态带时间信息，成功检查会清除旧错误；远端存在明文插件 `data.json` 时给出明确的安全策略错误，而不是普通路径失败。
- 旧版 Obsidian 主题/Electron 壳不支持 `color-mix()` 时，设置页按钮、页签和卡片仍有稳定的主题变量回退样式，减少双端基态/悬停态差异。

### 安全边界

- 不会将公开插件仓库改成笔记仓库；PAT、恢复密钥和 Vault 内容不进入公开源码或发行包。
- v0.1.2 公开 Release 不被覆盖或移动。本版本已推送源码并在 macOS 本机验证；源码推送和本机安装不等于发布 v0.1.3 Release。
- Windows CI/本地 Git 测试不等于 Windows Obsidian 图形界面实机验收；代理和 LFS 仍依赖用户本机环境。

### 验证状态（2026-10-14）

- 对源码提交 `bbbd5e2`，本机 TypeScript、20 个测试文件／72 项测试及构建通过，macOS／Windows CI 通过；macOS Obsidian 1.14.4 的正常重启、运行版本、四页切换及 schema 1 → 2 配置迁移已做基础验收。
- Windows 原生第二设备、企业代理及完整多设备同步仍有未验证范围；没有用真实 Vault 执行上传或恢复回归。详细证据范围与发布前检查见[验收记录](VALIDATION_v0.1.3.md)。

## English

This is an unreleased source preview focused on second-device Windows bootstrap from an empty Vault.

### Fixes and improvements

- Legacy/prototype sync policies are upgraded with mandatory safety exclusions, so third-party plugin `data.json`, temporary encrypted bundles, and common credential files do not silently become plaintext sync inputs.
- Importing a recovery key on a second device no longer immediately enables encrypted uploads. The remote encrypted bundle must be reviewed and restored first, preventing an empty local bundle from overwriting the primary device or PAT differences from causing digest ping-pong.
- Encrypted bundle digests ignore device-local identity fields (PAT, auth type, OAuth Client ID, and Git proxy) while the encrypted payload remains available for an explicit full-login restore; v0.1.2 legacy digests remain readable.
- Remote-first clone avoids depending on the global Git LFS smudge filter: it clones without smudging, installs the local LFS filter, and pulls objects explicitly. A repository with LFS pointers is rejected clearly when Git LFS is unavailable.
- Adds an optional repository-scoped Git HTTP/SOCKS proxy. It is passed only to Git commands and never written into the remote URL. Transport errors explain whether to inspect the configured proxy or the network path.
- Error feedback includes a timestamp and clears after a successful check; plaintext remote plugin `data.json` files produce a specific safety-policy error.
- Adds theme-token fallbacks for older Electron shells without `color-mix()`, reducing baseline/hover differences across Obsidian installations.

### Validation status (2026-10-14)

Source commit `bbbd5e2` passed local TypeScript checks, 20 test files / 72 tests, the production build, and macOS/Windows CI. A separate macOS Obsidian 1.14.4 smoke check verified normal restart, the running plugin version, four settings pages, and schema 1 → 2 migration. These checks do not establish native Windows second-device, corporate-proxy, or full multi-device-sync acceptance; no real-vault upload or restore regression was performed. See the [validation record](VALIDATION_v0.1.3.md).

The public v0.1.2 Release remains immutable. Creating a v0.1.3 Release still requires explicit authorization and resolution of the remaining acceptance checks.
