# GitHub Vault Sync v0.1.0 — First public release

## 中文

这是 GitHub Vault Sync 的**首次公开发布**（版本编号 v0.1.0）。它基于此前的本地原型功能制作；如果你已在个人 Vault 中使用编号更高的内部原型，不必为此首发版盲目降级。此**公开插件仓库只包含代码/安装包**；你的 Obsidian 笔记必须绑定**另外一个私有仓库**。

**主要功能**：同步前笔记优先差异预览、本机/仓库/逐篇 Markdown 冲突决策、未选版本本地备份、附件 Git LFS、阶段进度、只检查不自动上传、插件私有配置客户端 AES-256-GCM 加密镜像和手动恢复。无强制推送；明文 `data.json`、PAT、恢复密钥不在安装包中。

**安装**：下载本 Release 的 `github-vault-sync-0.1.0.zip`，解压到 `<Vault>/.obsidian/plugins/`，启用插件并先备份 Vault。需要 Obsidian 桌面版 1.13.0+、Git，附件匹配 LFS 规则时需要 Git LFS。详情见 ZIP 内 `README.zh-CN.md` 或仓库根目录中文说明。

## English

This is the **first public release** (v0.1.0), packaged from the existing local prototype. If you already run an internal build numbered above v0.1.0, do not replace it blindly. This **public plugin repository distributes code only**; connect a **different private GitHub repository** for your notes.

**Highlights**: note-first preview with a required per-run Markdown conflict priority, preservation of the losing text version, Git LFS attachments, honest phase progress, background checking without automatic uploads, and authenticated client-side AES-256-GCM backups of excluded plugin settings. No force push. The ZIP has no plaintext `data.json`, PAT, or recovery key.

**Install**: extract `github-vault-sync-0.1.0.zip` into `<Vault>/.obsidian/plugins/`, enable the plugin and back up your vault first. Requires Obsidian desktop 1.13.0+, Git and Git LFS when syncing matching attachments. See `README.md` inside the ZIP or the repository root.

## 唯一安装资产 / Single install asset

- `github-vault-sync-0.1.0.zip` — 唯一需要下载的插件安装包，内部包含 `github-vault-sync/manifest.json`、`main.js`、`styles.css`、中英文安装说明；解压到 `<Vault>/.obsidian/plugins/`，重启后启用。无需再下载其他 Release 资产。电脑上仍需已有 Git，按附件规则使用 Git LFS 时仍需安装 Git LFS。
- GitHub 自动显示的 **Source code (zip/tar.gz)** 无法手动删除，且源码包不含项目根目录的构建产物 `main.js`，请勿把它当作插件安装包。

- `github-vault-sync-0.1.0.zip` is the **only manually uploaded release asset**. It includes `manifest.json`, `main.js`, `styles.css`, and English/Chinese setup instructions under one `github-vault-sync/` folder. Extract into `<Vault>/.obsidian/plugins/`, restart Obsidian, and enable the plugin. No other Release downloads, Node.js, or pnpm are needed for installation. Git and (for matching attachments) Git LFS are still operating-system prerequisites.
- GitHub-generated **Source code (zip/tar.gz)** links cannot be removed and are **not** plugin installers: the source tree does not contain the compiled root `main.js`.

ZIP SHA-256 / 安装包 SHA-256：`c5768e674ad6db7674b23827ca63a4e725b1cc65cbdf092d7f81288ec95ace38`。

No vault notes, plaintext credentials, recovery keys, or private development conversations are shipped.
