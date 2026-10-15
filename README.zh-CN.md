# GitHub Vault Sync

[English](README.md)

**v0.2.0（开发中，尚未发布）：**在整库同步预览中加入不阻塞同步的媒体优化建议，新增第五个“媒体优化”设置页、带质量护栏的转换命令及 AVIF Git LFS 规则迁移。当前最新可安装版本仍为 v0.1.3。

**v0.1.3（2026-10-14）：**改进第二设备初始化、旧配置安全规则迁移、加密恢复顺序、Git LFS 文件落地、仓库级代理诊断及旧 Electron 样式回退。下载单一 [v0.1.3 安装 ZIP](releases/github-vault-sync-0.1.3.zip)。Windows 原生第二设备验收仍待完成，详见[验证范围与已知限制](docs/VALIDATION_v0.1.3.md)。

 · [开发过程与交接记录](docs/PROJECT_HISTORY.md)

**GitHub Vault Sync** 是 Obsidian 桌面端插件，可将笔记库同步到**另外一个由你控制的私有 GitHub 仓库**。本项目公开仓库只发布插件源码与安装包，**不要把笔记或凭据上传到本公开仓库**。

## UI Motion 界面动效导览（v0.1.3）

以下是使用插件样式和代表性设置／预览结构、以示例数据制作的**界面动效演示**。它们展示状态变化、先预览再处理冲突，以及加密配置的边界；不是 Obsidian 实际运行录屏，也不会执行同步。已确认的视频均为 1280×720、30fps 的 H.264 MP4。在 GitHub 页面请使用下方 MP4 链接；允许 HTML 视频的 Markdown 阅读器还可显示内嵌播放器。

### 状态流转：本地变化 → 读取远端 → 预览 → 完成

[观看状态流转 MP4](docs/media/overview-b-status-flow.mp4) · 4.8 秒

<video controls preload="metadata" width="720" style="max-width:100%;height:auto">
  <source src="docs/media/overview-b-status-flow.mp4" type="video/mp4">
  此阅读器不支持视频播放，请使用上方链接。
</video>

### 预览 → 选择 → 确认

[观看预览流程 MP4](docs/media/safe-sync-a-preview.mp4) · 7.2 秒

<video controls preload="metadata" width="720" style="max-width:100%;height:auto">
  <source src="docs/media/safe-sync-a-preview.mp4" type="video/mp4">
  此阅读器不支持视频播放，请使用上方链接。
</video>

### 加密配置边界

[观看加密边界 MP4](docs/media/recovery-c-encrypted-boundary.mp4) · 4.8 秒

<video controls preload="metadata" width="720" style="max-width:100%;height:auto">
  <source src="docs/media/recovery-c-encrypted-boundary.mp4" type="video/mp4">
  此阅读器不支持视频播放，请使用上方链接。
</video>

## 安装 v0.1.3

v0.1.3 保留当前笔记同步、上传前预览和四个独立设置页，重点加固第二设备加密配置及 Git/LFS 初始化，补齐旧版安全排除规则并加入仓库级代理诊断。详见[更新说明](docs/RELEASE_NOTES_v0.1.3.md)与[独立安装／升级指南](docs/install/README.zh-CN.md)。

1. 先备份 Obsidian Vault。安装 Git；如需同步图片、PDF 等符合附件规则的文件，另需安装 Git LFS。
2. 打开本项目 GitHub 的 **Releases**，下载 `github-vault-sync-0.1.3.zip`。**唯一手动上传的 Release 资产**就是此 ZIP；仓库也保留同一份 [`releases/github-vault-sync-0.1.3.zip`](releases/github-vault-sync-0.1.3.zip)。GitHub 自动生成的“Source code (zip/tar.gz)”**不是可安装插件包**，因为项目根目录不收录构建后的 `main.js`。
3. 保存笔记并正常退出 Obsidian，然后将 ZIP 解压到 `<Vault>/.obsidian/plugins/`，确认结果为：

   ```text
   <Vault>/.obsidian/plugins/github-vault-sync/manifest.json
   <Vault>/.obsidian/plugins/github-vault-sync/main.js
   <Vault>/.obsidian/plugins/github-vault-sync/styles.css
   ```

   Windows 典型路径为 `C:\Users\<用户名>\Documents\笔记库\.obsidian\plugins\github-vault-sync\`；macOS 使用 `<Vault>/.obsidian/plugins/github-vault-sync/`。**升级时保留原有本机 `data.json`，不要删除后重建整个插件目录。**

   不要多套一层 `github-vault-sync/`。ZIP 已含全部插件文件和双语安装说明；手动安装不用再单独下载 Release 资产，也无需 Node.js、pnpm。Git 及按附件规则需要的 Git LFS 仍是**系统层依赖**。安装包不含 Token、恢复密钥或个人笔记。
4. 重新打开 Obsidian，在「设置 → 第三方插件」启用 **GitHub Vault Sync**。适用于 **Windows 和 macOS 的 Obsidian 桌面版 1.13.0+**（也支持 Linux 桌面版）；不支持移动端。Windows、macOS 使用同一个 ZIP。

如果你当前已经安装标为 `0.4.0` 的本地原型，公开 `0.1.0` 才是**首次公开发行**；`0.1.3` 延续这一公开版本系列，不等同于内部 `0.4.0` 的版本降级或升级。无需仅为了下载公开包就替换正常运行的安装；手动替换前请备份 Vault，并保留本地的 `data.json`。

## 连接自己的私有笔记仓库

1. 在插件设置里通过仅授权目标**私有笔记仓库**读写的 PAT 连接 GitHub。不要将 PAT 贴到公开仓库或聊天中。如有自行注册并启用 Device Flow 的 GitHub OAuth App，也可填写 Client ID 进行浏览器授权。
2. 在插件内新建或绑定**另一个私有仓库**，确认 `main` 分支与首次绑定预览。本公开插件仓库**不是**笔记数据仓库。
3. 保留一份独立的本地 Vault 备份，避免让其他仍在工作的同步插件同时改动同一批文件。

## 安全同步：先预览再确认

点击设置页或同步中心的 **「预览并同步」**。上传前插件会获取远端提交并只读比较，依次列出：① Markdown 笔记；② 所属笔记文件夹的附件；③ Obsidian 插件、设置与加密包；④ 其他文件。两台设备均修改过同一篇笔记时，可以并排阅读本地和仓库内容。

**每次都需选择冲突优先方：**本设备优先、仓库优先或逐篇决定。该选择**只针对同一路径且两边都修改过的 Markdown 笔记**；两端各自独立的改动正常合并。插件配置、加密包和二进制附件冲突仍需逐个选择。未选中的 Markdown 版本留在本地 `.github-vault-sync-conflicts/`，此目录不会上传。文件时间只供参考，不能仅凭时钟证明文本最新。如果预览后本地文件或远端提交发生变化，插件会拒绝过期的确认并要求重看预览。插件不强制推送。

进度条在 Git 能报告文件／对象数量时显示阶段百分比；没有可靠上传计数时显示不确定进度，不假报进度。**及时检查**在本地改动后按设定延迟（默认 90 秒）检查，并每 5 分钟检查远端，**绝不绕过预览自动上传**。

## 上传前媒体优化（v0.2.0 开发版）

开发版在整库同步预览中列出超过阈值的已纳入 PNG/JPG/JPEG、PDF、MP4 和 GIF 文件。媒体建议**不会阻塞同步**，插件也不会执行转换。「媒体优化」设置页可调整阈值（默认 2 MB）、仅作用于建议的 glob 排除规则、图像 PSNR 质量下限（默认 35 dB），以及是否显示预估节省。

每个文件都提供「复制转换命令」，「一键复制全部转换命令」还会复制全部分页中的命令。请在 Vault 根目录的终端执行；Windows 使用 Git Bash。图像依赖 Pillow 和 `pillow-avif-plugin`，PDF 依赖 Ghostscript，MP4 需要含 `libsvtav1` 的 FFmpeg，GIF 需要含 `libwebp` 的 FFmpeg。PNG 从 AVIF q70、JPG 从 q60 开始，随后逐档尝试至 q100，直到达到设定的 PSNR 下限；仍不达标则不留下转换文件。已有目标不会被覆盖，输出重名时会追加短哈希。

PDF 使用 Ghostscript `/ebook`，MP4 使用 AV1，GIF 生成动态 WebP。预估节省来自真实样本的投影系数，不保证单个文件的实际结果。有损替换不可逆：请保留冷备份，检查生成文件，自行更新笔记引用，再重新打开同步预览。AVIF 已加入默认 Git LFS 规则，并会在 0.2.0 之前的配置迁移时补充一次。

## 加密配置与恢复密钥

插件 `data.json`、凭据类点文件及明确排除的特殊插件目录**不会以明文提交**。启用客户端 AES-256-GCM 加密后，它们的备份可作为 `.github-vault-sync-encrypted/vault.gvs` 密文同步。加密密钥只保存在本机。点击 **「查看并复制恢复密钥」** 才在弹窗显示并支持复制；关闭弹窗就隐藏。务必在 Vault 和 GitHub **之外**保存一份独立、安全的副本。拥有加密仓库和密钥的人可以解密插件凭据；遗失密钥则无法恢复云端密文。

另一台桌面设备应先安装插件、绑定同一私有笔记仓库，在本机导入恢复密钥、获取加密包，再选择「恢复加密配置」。新恢复密钥和恢复备份默认保存在 macOS 当前用户的 `Library/Application Support/github-vault-sync-backups/`，或 Windows 当前用户的 `%APPDATA%\github-vault-sync-backups\`（Linux 则是 XDG 用户数据目录）。请用操作系统账户权限保护本机 Vault 与 `data.json`；Windows ACL 不能等同于 Unix 的 `chmod`。恢复前会备份被覆盖的本地文件，默认保留本设备当前的 GitHub 登录。恢复后重启 Obsidian。远端加密包或可执行插件代码有更新时，不会被自动应用，须手动审核。

## 跨平台验证

macOS／Windows CI 会运行 TypeScript 检查、临时本地 Git/Git LFS 集成测试和生产构建。**Release 标签 CI 还会核对 ZIP 与构建产物；`main`／PR 开发构建不要求提供未发布版本的 ZIP。**CI 不是 Windows 的 Obsidian 图形界面实机测试，也无法保证适配所有第三方主题或 Git 安装方式。本轮另在 macOS 宿主验证了 v0.1.3 运行版本、四页设置和配置安全迁移，未执行真实同步或恢复。详见[验证范围](docs/VALIDATION_v0.1.3.md)；遇到平台问题请提供系统、Obsidian 版本及不含密钥的诊断信息。CI 不接触真实笔记库或 GitHub Token。

## 从源码构建

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

构建产物为项目根目录的 `main.js`；发布者可运行 `python scripts/release_archive.py build` 生成并校验白名单 ZIP。包内采用 `docs/install/` 下的独立中英说明，不直接复制仓库 README；在线动效与文档链接固定到本版标签。安装到 Vault 的只需 `manifest.json`、`main.js`、`styles.css`。现成安装包请使用唯一的 [Release ZIP](releases/github-vault-sync-0.1.3.zip)。架构、设计决策、测试和已脱敏的开发对话时间线见 [项目交接文档](docs/PROJECT_HISTORY.md)。

## 安全提示

私有仓库不等于密钥或离线备份；上传前请复核差异，留意 Git LFS 限制，并将恢复密钥保存在两个仓库之外。敏感文件扫描采用启发式规则，不能形式化保证任意笔记和第三方插件代码不含凭据。本公开项目仓库不会接收你的笔记库。
