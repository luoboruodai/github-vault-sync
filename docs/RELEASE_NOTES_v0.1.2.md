# GitHub Vault Sync v0.1.2 — Four-page settings and desktop portability

## 中文

这是 v0.1.1 的兼容迭代，继续保留“同步当前笔记”、同步前预览、手工冲突确认与加密配置备份。**不会自动上传真实笔记。**

### 变化

- 设置页现在有四个真正独立的页面：笔记同步、隐私与恢复、账户与仓库、高级设置。点击页签直接切换，不再滚动跳转；草稿控件保持挂载，支持左右键与 Home/End。
- 对照 Obsidian 原生设置及 Easy Typing 的页签模式，调整标题/说明对齐、间距、按钮主次与危险状态、状态摘要、窄窗口 2×2 页签；动效有边界，遵守系统减少动态效果设置。
- 恢复密钥与恢复备份默认改为用户所属系统的数据目录：macOS `~/Library/Application Support/github-vault-sync-backups/`、Windows `%APPDATA%\github-vault-sync-backups\`、Linux 的 XDG 用户数据目录。macOS 路径保持向后兼容；Windows 不把 POSIX `chmod` 当作 ACL 保证。
- 单一 ZIP 同时适用于 Windows 与 macOS 的 Obsidian 桌面版 1.13.0+。系统 Git 与需要上传附件时的 Git LFS 仍需另行安装。macOS／Windows CI 检查代码、临时本地 Git/LFS、构建、归档文件一致性；CI **不等于 Windows Obsidian 图形界面实机验收**。

### 安装与更新

只下载本次 Release 的 `github-vault-sync-0.1.2.zip`，解压到 Vault 的 `.obsidian/plugins/`，最后应有 `.obsidian/plugins/github-vault-sync/manifest.json`、`main.js` 与 `styles.css`。升级时备份 Vault 并**保留本机原有 `data.json`**；保存正在编辑的笔记再重启 Obsidian，在「设置 → 第三方插件」启用。压缩包附中英文说明，不含私人笔记、访问令牌或恢复密钥。不要使用 GitHub 自动生成的 Source code ZIP 作为插件安装包。

连接的是你自己另建的**私有笔记仓库**，不是本公开插件源码仓库。同步前仍需逐次预览和确认；恢复密钥须单独安全保存。

## English

This is a compatible follow-up to v0.1.1. Current-note sync, preview-first merging, manual conflict review, and encrypted configuration backups remain available. **The plugin does not automatically upload a real vault.**

### Changes

- Four actual settings pages—Notes, Privacy & Recovery, Account & Repository, Advanced—replace scrolling jump links. Switching keeps form controls mounted and supports Left/Right and Home/End.
- Refined heading/description alignment, spacing, primary/secondary/danger button states, status summary, responsive 2×2 tab layout, and bounded transitions that honor reduced-motion preferences.
- Recovery keys and restore backups now use the OS user data directory: `~/Library/Application Support/github-vault-sync-backups/` on macOS (unchanged), `%APPDATA%\github-vault-sync-backups\` on Windows, and the XDG user data directory on Linux. Windows ACLs are not equivalent to POSIX `chmod`.
- One ZIP supports Obsidian desktop 1.13.0+ on Windows and macOS; install system Git and Git LFS separately where needed. macOS/Windows CI checks source, temporary local Git/LFS behavior, builds, and archive contents. **CI is not a native Windows Obsidian GUI session.**

### Install / update

Download the release asset `github-vault-sync-0.1.2.zip` (not GitHub's automatic source ZIP). Extract into the Vault's `.obsidian/plugins/`, so `github-vault-sync/` contains `manifest.json`, `main.js`, and `styles.css`. Back up the Vault and **keep your existing local `data.json`** when upgrading. Save open notes, restart Obsidian, and enable the plugin in Settings → Community plugins. The ZIP includes English and Chinese instructions, but no personal notes, PAT, or recovery key.

Bind your own **separate private vault repository**, not the public plugin source repository. Every upload still requires a preview and explicit confirmation; store your recovery key independently.
