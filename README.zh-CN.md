# GitHub Vault Sync

[English](README.md) · [开发过程与交接记录](docs/PROJECT_HISTORY.md)

**GitHub Vault Sync** 是 Obsidian 桌面端插件，可将笔记库同步到**另外一个由你控制的私有 GitHub 仓库**。本项目公开仓库只发布插件源码与安装包，**不要把笔记或凭据上传到本公开仓库**。

## 安装 v0.1.0

1. 先备份 Obsidian Vault。安装 Git；如需同步图片、PDF 等符合附件规则的文件，另需安装 Git LFS。
2. 打开本项目 GitHub 的 **Releases**，下载 `github-vault-sync-0.1.0.zip`。**唯一手动上传的 Release 资产**就是此 ZIP；仓库也保留同一份 [`releases/github-vault-sync-0.1.0.zip`](releases/github-vault-sync-0.1.0.zip)。GitHub 自动生成的“Source code (zip/tar.gz)”**不是可安装插件包**，因为项目根目录不收录构建后的 `main.js`。
3. 将 ZIP 解压到 `<Vault>/.obsidian/plugins/`，确认结果为：

   ```text
   <Vault>/.obsidian/plugins/github-vault-sync/manifest.json
   <Vault>/.obsidian/plugins/github-vault-sync/main.js
   <Vault>/.obsidian/plugins/github-vault-sync/styles.css
   ```

   不要多套一层 `github-vault-sync/`。ZIP 已含全部插件文件和双语安装说明；手动安装不用再单独下载 Release 资产，也无需 Node.js、pnpm。Git 及按附件规则需要的 Git LFS 仍是**系统层依赖**。安装包不含 Token、恢复密钥或个人笔记。
4. 重启 Obsidian，在「设置 → 第三方插件」启用 **GitHub Vault Sync**。仅支持 **Obsidian 桌面版 1.13.0+**，不支持移动端。

如果你当前已经安装标为 `0.4.0` 的本地原型，公开 `0.1.0` 是**首次公开发行编号，不是更高版本的升级**。无需仅为了下载公开包就替换正常运行的安装；手动替换前请备份 Vault，并保留本地的 `data.json`。

## 连接自己的私有笔记仓库

1. 在插件设置里通过仅授权目标**私有笔记仓库**读写的 PAT 连接 GitHub。不要将 PAT 贴到公开仓库或聊天中。如有自行注册并启用 Device Flow 的 GitHub OAuth App，也可填写 Client ID 进行浏览器授权。
2. 在插件内新建或绑定**另一个私有仓库**，确认 `main` 分支与首次绑定预览。本公开插件仓库**不是**笔记数据仓库。
3. 保留一份独立的本地 Vault 备份，避免让其他仍在工作的同步插件同时改动同一批文件。

## 安全同步：先预览再确认

点击设置页或同步中心的 **「预览并同步」**。上传前插件会获取远端提交并只读比较，依次列出：① Markdown 笔记；② 所属笔记文件夹的附件；③ Obsidian 插件、设置与加密包；④ 其他文件。两台设备均修改过同一篇笔记时，可以并排阅读本地和仓库内容。

**每次都需选择冲突优先方：**本设备优先、仓库优先或逐篇决定。该选择**只针对同一路径且两边都修改过的 Markdown 笔记**；两端各自独立的改动正常合并。插件配置、加密包和二进制附件冲突仍需逐个选择。未选中的 Markdown 版本留在本地 `.github-vault-sync-conflicts/`，此目录不会上传。文件时间只供参考，不能仅凭时钟证明文本最新。如果预览后本地文件或远端提交发生变化，插件会拒绝过期的确认并要求重看预览。插件不强制推送。

进度条在 Git 能报告文件／对象数量时显示阶段百分比；没有可靠上传计数时显示不确定进度，不假报进度。**及时检查**在本地改动后按设定延迟（默认 90 秒）检查，并每 5 分钟检查远端，**绝不绕过预览自动上传**。

## 加密配置与恢复密钥

插件 `data.json`、凭据类点文件及明确排除的特殊插件目录**不会以明文提交**。启用客户端 AES-256-GCM 加密后，它们的备份可作为 `.github-vault-sync-encrypted/vault.gvs` 密文同步。加密密钥只保存在本机。点击 **「查看并复制恢复密钥」** 才在弹窗显示并支持复制；关闭弹窗就隐藏。务必在 Vault 和 GitHub **之外**保存一份独立、安全的副本。拥有加密仓库和密钥的人可以解密插件凭据；遗失密钥则无法恢复云端密文。

另一台桌面设备应先安装插件、绑定同一私有笔记仓库，在本机导入恢复密钥、获取加密包，再选择「恢复加密配置」。恢复前会备份被覆盖的本地文件，默认保留本设备当前的 GitHub 登录。恢复后重启 Obsidian。远端加密包或可执行插件代码有更新时，不会被自动应用，须手动审核。

## 从源码构建

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

构建产物为项目根目录的 `main.js`；安装到 Vault 的只需 `manifest.json`、`main.js`、`styles.css`。现成安装包请使用唯一的 [Release ZIP](releases/github-vault-sync-0.1.0.zip)。架构、设计决策、测试和已脱敏的开发对话时间线见 [项目交接文档](docs/PROJECT_HISTORY.md)。

## 安全提示

私有仓库不等于密钥或离线备份；上传前请复核差异，留意 Git LFS 限制，并将恢复密钥保存在两个仓库之外。敏感文件扫描采用启发式规则，不能形式化保证任意笔记和第三方插件代码不含凭据。本公开项目仓库不会接收你的笔记库。
