# GitHub Vault Sync v0.1.3 — 安装与升级说明

[English](README.md)

此 ZIP 包含完整的 Obsidian 桌面插件及本说明。**安装或升级前先备份笔记库。**包内不包含你的配置、凭据或笔记。

## 环境要求

- Obsidian **桌面版 1.13.0 或以上**；Windows／macOS 使用同一 ZIP，不支持移动版。代码支持 Linux 桌面端，但本版尚未做 Linux 原生宿主验收。
- 另行安装系统 **Git**；同步符合 LFS 规则的附件前，还需安装 **Git LFS**。它们不捆绑在 ZIP 内；运行插件不需要 Node.js、npm 或 pnpm。
- 笔记库应绑定你自己另外创建的**私有 GitHub 仓库**，不要绑定插件的公开源码仓库。

## 首次安装

1. 保存当前笔记，备份 Vault，并正常退出 Obsidian。
2. 将 ZIP 解压到 `<Vault>/.obsidian/plugins/`。ZIP 本身已有一层 `github-vault-sync/`，最终结构应为：

   ```text
   <Vault>/.obsidian/plugins/github-vault-sync/manifest.json
   <Vault>/.obsidian/plugins/github-vault-sync/main.js
   <Vault>/.obsidian/plugins/github-vault-sync/styles.css
   ```

   不要多出 `github-vault-sync/github-vault-sync/` 嵌套。两份 README 只是附带说明，不是插件运行依赖。
3. 打开 Obsidian，在「设置 → 第三方插件」启用 **GitHub Vault Sync**，进入插件设置确认版本为 **v0.1.3**。
4. 使用仅对目标私有笔记仓库授权的凭据连接，检查首次绑定预览。PAT 和恢复密钥不要贴进聊天或公开源码仓库。

Windows 常见目标路径为 `%USERPROFILE%\Documents\YourVault\.obsidian\plugins\github-vault-sync\`，应以你的真实 Vault 路径为准。

## 升级现有插件

1. 保存笔记并正常退出 Obsidian；不要使用会丢弃编辑内容的重载入口。
2. 把旧插件安装文件和本机 **`data.json` 一起备份到 Vault 之外**，并限制为当前系统用户可访问。该配置文件可能含 PAT 与恢复密钥。
3. 只将此包中的 `manifest.json`、`main.js`、`styles.css` 覆盖到原插件目录。**保留原有 `data.json`，不要删除或覆盖它**；不要替换整个 Vault 或整个插件目录。
4. 重开 Obsidian，在插件设置中核对运行版本。v0.1.3 会把旧配置迁移至 schema 2，并可能更新本地密文镜像；加载后的哈希变化不一定表示配置丢失，应保留备份并检查异常变化。
5. 升级产生的安装文件或密文变化**不等于自动上传授权**。先预览本地和远端差异，尤其注意密文包两端都有变化的情况；不要让多个同步插件同时处理同一份 Vault。

## 安全同步与恢复

- 「预览并同步」必须明确确认。自动检查只发现差异、提醒用户，不会自动上传整库；冲突优先方仅用于两端都改动的同路径 Markdown，附件和插件／配置文件须单独审阅。
- 第二设备先绑定同一私有仓库并取得远端密文包，再在本机导入恢复密钥、检查恢复操作，不要生成空配置包覆盖远端。
- 恢复密钥应独立、安全地保存在 **Vault 和 GitHub 之外**。恢复前先备份被覆盖文件，默认保留本设备登录。下载的可执行插件代码须人工审阅，批准恢复后重启 Obsidian。
- 若升级后无法加载，先正常退出 Obsidian，再从已保存的备份恢复安装文件。配置只从你自己的可靠备份恢复，不能为匹配版本号而丢弃较新的用户修改。

## 验证范围与限制

v0.1.3 实现已通过本机测试及 macOS Obsidian 1.14.4 基础验收：正常重启、运行版本、四页切换、配置迁移。发布工作流在 macOS／Windows 检查源码、构建和安装包内容一致性。**Windows CI 不等于 Windows 原生 Obsidian 图形界面或第二设备验收。**企业／认证代理以及完整双端附件、恢复场景仍依赖实际环境，不声称已经全部验证。

动效和工程记录仅提供**在线版本**，有意不放进安装 ZIP：

- [当前版本动效与完整指南（需联网）](https://github.com/luoboruodai/github-vault-sync/blob/v0.1.3/README.zh-CN.md)
- [当前版本验证记录（需联网）](https://github.com/luoboruodai/github-vault-sync/blob/v0.1.3/docs/VALIDATION_v0.1.3.md)
- [v0.1.3 Release（需联网）](https://github.com/luoboruodai/github-vault-sync/releases/tag/v0.1.3)

应下载该 Release 的 `github-vault-sync-0.1.3.zip`。GitHub 自动生成的 **Source code** 源码归档不含已构建的运行文件，不能当插件安装包使用。
