# GitHub Vault Sync v0.1.1 — Note-first sync and safer Vault migration

## 中文

这是公开 v0.1.0 之后的兼容更新，适合已经使用 v0.1.x 的用户。内部曾使用过更高编号原型的用户不应仅为下载本包而覆盖正在工作的安装；手动替换前请备份 Vault，并保留本机插件 `data.json`。

### 主要变化

- 在当前 Markdown 笔记标题栏、命令面板和同步中心增加“仅同步当前笔记”入口。
- 当前笔记预览只纳入 Obsidian 元数据中实际嵌入的非 Markdown 附件；普通笔记链接不会被误当成上传范围。
- 单笔记上传只暂存批准的笔记与附件，检查 GitHub 提交、Git 索引和文件指纹；预览后任一端变化、已有暂存或合并未完成时拒绝过期上传。
- 首次绑定已有仓库前检查同路径笔记内容、配置、附件、同名不同目录、大小写/Unicode 及文件/文件夹冲突；仓库优先会在当前 Vault 旁边创建独立副本，不清空当前笔记库。
- 设置页按常用操作、隐私恢复、账户仓库和高级规则分组；同步预览按 Markdown、笔记文件夹附件、Obsidian 配置、其他文件排序，并显示文件级差异百分比与上传阶段进度。
- 冲突批量选择只作用于 Markdown；插件配置、加密包和二进制附件仍需逐文件确认。重复点击和过期确认会被阻止。
- 继续使用客户端 AES-256-GCM 加密同步插件 `data.json` 与配置例外；明文凭据、PAT、恢复密钥和私人笔记不进入公开项目或安装包。

### 安装

下载本 Release 的唯一手动资产 `github-vault-sync-0.1.1.zip`，解压到 `<Vault>/.obsidian/plugins/`，确认目录为 `<Vault>/.obsidian/plugins/github-vault-sync/`，重启 Obsidian 后在「设置 → 第三方插件」启用。需要 Obsidian 桌面版 1.13.0+、系统 Git；同步符合规则的图片、PDF、音视频等附件时还需要 Git LFS。ZIP 已包含插件运行所需的 `manifest.json`、编译后的 `main.js`、`styles.css` 和双语说明，无需 Node.js 或 pnpm。

GitHub 自动生成的 Source code 压缩包不是插件安装包；它们不包含项目根目录被忽略的构建产物 `main.js`。笔记必须连接到你自己控制的**另一个私有 GitHub 仓库**，不要把笔记上传到公开插件仓库。

安装包 SHA-256：`bba0cb1ab7ea304896a881c5d562bc54c00038b8e3687fbd9abfb4c81c5cd675`。

## English

This is a compatible follow-up to public v0.1.0 for users already on v0.1.x. If you use an internal build with a higher prototype number, do not overwrite a working installation merely to install this public package; back up the vault and keep the local plugin `data.json` before any manual replacement.

### Highlights

- Adds a dedicated “sync current note only” action in the active Markdown view, command palette, and Sync Center.
- The current-note preview includes only non-Markdown files that Obsidian metadata identifies as actual embeds; ordinary note links are not silently expanded into upload scope.
- Current-note upload stages only the approved note and attachments and rechecks the GitHub commit, index, and file fingerprint. It rejects stale previews, existing staged files, and unfinished merges.
- First binding now reviews same-path Markdown bytes, configuration, attachments, same-name notes in different folders, case/Unicode collisions, and file/folder collisions. Repository-first creates a separate Vault copy beside the current Vault instead of clearing it.
- Settings are organized around common actions, privacy/recovery, account/repository, and advanced rules. The sync preview orders Markdown, note-folder attachments, Obsidian configuration, and other files, while showing file-level difference percentage and honest transfer progress.
- Bulk conflict selection applies only to Markdown. Plugin configuration, encrypted bundles, and binary attachments still require file-level choices. Repeated clicks and stale approvals are guarded.
- Client-side AES-256-GCM encrypted sync remains available for plugin `data.json` and configured exceptions. Plaintext credentials, PATs, recovery keys, and personal notes are not shipped in the public project or installer.

### Install

Download the only manually uploaded Release asset, `github-vault-sync-0.1.1.zip`, and extract it into `<Vault>/.obsidian/plugins/`. Confirm the folder is `<Vault>/.obsidian/plugins/github-vault-sync/`, restart Obsidian, and enable the plugin under **Settings → Community plugins**. Requires Obsidian desktop 1.13.0+, system Git, and Git LFS for attachments matching the configured rules. The ZIP includes `manifest.json`, the compiled `main.js`, `styles.css`, and bilingual instructions; Node.js and pnpm are not needed for installation.

GitHub-generated Source code archives are not plugin installers because they omit the ignored root build output `main.js`. Connect your notes to a **separate private GitHub repository** that you control; never upload notes to this public plugin repository.

Installer SHA-256: `bba0cb1ab7ea304896a881c5d562bc54c00038b8e3687fbd9abfb4c81c5cd675`.
