# GitHub Vault Sync v0.1.0 — First public release

## 中文

这是 GitHub Vault Sync 的**首次公开发布**（版本编号 v0.1.0）。它基于此前的本地原型功能制作；如果你已在个人 Vault 中使用编号更高的内部原型，不必为此首发版盲目降级。此**公开插件仓库只包含代码/安装包**；你的 Obsidian 笔记必须绑定**另外一个私有仓库**。

**主要功能**：同步前笔记优先差异预览、本机/仓库/逐篇 Markdown 冲突决策、未选版本本地备份、附件 Git LFS、阶段进度、只检查不自动上传、插件私有配置客户端 AES-256-GCM 加密镜像和手动恢复。无强制推送；明文 `data.json`、PAT、恢复密钥不在安装包中。

**安装**：下载本 Release 的 `github-vault-sync-0.1.0.zip`，解压到 `<Vault>/.obsidian/plugins/`，启用插件并先备份 Vault。需要 Obsidian 桌面版 1.13.0+、Git，附件匹配 LFS 规则时需要 Git LFS。详情见 ZIP 内 `README.zh-CN.md` 或仓库根目录中文说明。

## English

This is the **first public release** (v0.1.0), packaged from the existing local prototype. If you already run an internal build numbered above v0.1.0, do not replace it blindly. This **public plugin repository distributes code only**; connect a **different private GitHub repository** for your notes.

**Highlights**: note-first preview with a required per-run Markdown conflict priority, preservation of the losing text version, Git LFS attachments, honest phase progress, background checking without automatic uploads, and authenticated client-side AES-256-GCM backups of excluded plugin settings. No force push. The ZIP has no plaintext `data.json`, PAT, or recovery key.

**Install**: extract `github-vault-sync-0.1.0.zip` into `<Vault>/.obsidian/plugins/`, enable the plugin and back up your vault first. Requires Obsidian desktop 1.13.0+, Git and Git LFS when syncing matching attachments. See `README.md` inside the ZIP or the repository root.

## Assets

- `github-vault-sync-0.1.0.zip` — ready-to-install archive with folder `github-vault-sync/`.
- `main.js`, `manifest.json`, `styles.css` — standalone assets for manual install or supported plugin managers.
- `PROJECT_HISTORY.md` — sanitized development conversation and architecture handoff.
- `SHA256SUMS` — checksums for verifying downloads.

No individual Vault data, unencrypted plugin credentials, recovery key, or private development conversation is shipped.
