# GitHub Vault Sync v0.2.0 — Media guidance and guarded repository rebuilds

> **2026-10-16 · v0.2.0 release.** One installable ZIP for desktop Obsidian; preserve local settings when upgrading. Native Windows Obsidian GUI acceptance remains deferred and is not claimed as passed. See the [validation record](VALIDATION_v0.2.0.md).

## 中文

本版本在保留“先预览、再确认同步”的基础上，加入上传前媒体优化建议、更完整的批量复制交互，以及带多重安全确认的远程删库同名重建流程。

### 新增与改进

- 整库同步预览可列出超过阈值的 PNG/JPG/JPEG、PDF、MP4 和 GIF，提供预计转换后大小与目标路径。建议不阻塞同步，插件不会自行执行转换或删除源文件。
- 新增第五个「媒体优化」设置页，可配置文件阈值、仅作用于建议的 glob 排除、图像 PSNR 下限和预估节省显示；旧配置迁移到 schema 3，并一次性补充 AVIF Git LFS 规则。
- 每个文件可复制转换命令，也可一键复制全部命令。批量复制成功后，当前及后续加载的按钮会同步显示状态；列表滚动到底部自动追加 30 项并显示数量。
- 图像命令使用 AVIF 质量逐档提升和 PSNR 护栏，PDF 使用 Ghostscript `/ebook`，MP4 使用 AV1，GIF 使用动态 WebP。已有目标不会被覆盖，重名输出会追加确定性短哈希。
- 「远程重建准备」提供只读核对清单；「账户与仓库」中的「远程删库同名重建」会先预检远端、权限和所有者，并在 Vault 外创建、验证 Git bundle。
- 危险操作必须同时确认冷备份与当前历史、第二设备已暂停、原 Git/LFS 历史永久丢失，并精确输入 `owner/repo`。删除后核验 404，再按原 issues/wiki 设置私有重建、强推当前历史并核对远端 SHA；后续阶段失败不会自动重试删除。

### 第二设备与安全边界

远程删库同名重建后，另一台设备必须先备份旧克隆，再重新克隆重建后的仓库并执行 `git lfs pull`。核对插件绑定与恢复密钥后，才能恢复双端同步。

媒体命令需要用户另行安装对应依赖，并在 Vault 根目录手动运行；Windows 使用 Git Bash。有损转换不可逆，请保留冷备份、检查生成文件并自行更新笔记引用。公开插件仓库不是笔记仓库，PAT、恢复密钥和 Vault 内容不进入公开源码或发行包。

### 验证状态与已知限制

- 实现基线 `ba5eb9dc0d73bea94da5551570db653f9d9ae7f6` 已通过 TypeScript、23 个测试文件／101 项测试和生产构建；[主分支 CI 38865092891](https://github.com/luoboruodai/github-vault-sync/actions/runs/38865092891) 的 macOS／Windows Node 22 均成功。
- macOS Obsidian 1.14.4 验收覆盖五个设置页、媒体预览与复制交互，以及远程重建预检和确认门控。该重建功能验收只读并取消，没有为测试执行删除或重建。
- Windows Git Bash 的六组媒体样本命令已在实现阶段 CI 实际执行。**Windows CI 不等于 Windows 原生 Obsidian GUI；本版原生 Windows GUI 验收继续延期。**完整双端附件与恢复场景仍需各设备按实际环境验收。

### 安装／升级

下载本次 Release 唯一的手动附件 `github-vault-sync-0.2.0.zip`，不要使用自动生成的 Source code ZIP。保存笔记、备份 Vault 后正常退出 Obsidian；只替换 `.obsidian/plugins/github-vault-sync/` 中的三个运行文件，**保留现有本机 `data.json`**。重开后确认插件设置显示 v0.2.0。详细步骤见[独立中文指南](install/README.zh-CN.md)，ZIP 也附有同一份中英说明。

## English

This release keeps preview-first synchronization while adding media optimization guidance, complete batch-copy feedback, and a guarded remote delete-and-recreate workflow.

### New and improved

- Full sync previews can identify PNG/JPG/JPEG, PDF, MP4 and GIF files above a configurable threshold, with estimated output sizes and destinations. Suggestions never block sync; the plugin does not run conversions or delete sources.
- A fifth **Media optimization** settings page controls the threshold, advice-only glob exclusions, image PSNR floor and savings estimates. Settings migrate to schema 3 and add AVIF to the Git LFS rules once.
- Copy commands individually or all at once. A successful batch copy updates current and subsequently loaded buttons; scrolling to the end loads 30 more findings and updates the count.
- Image commands use stepped AVIF quality with a PSNR floor, PDFs use Ghostscript `/ebook`, MP4s use AV1, and GIFs produce animated WebP. Existing destinations are never overwritten and colliding names receive a deterministic short hash.
- **Remote rebuild checklist** remains read-only. **Remote delete-and-recreate** preflights the remote, permissions and owner, then creates and verifies a Git bundle outside the vault.
- The dangerous action requires confirmation of the cold backup and desired history, second-device pause, permanent Git/LFS history loss, and the exact `owner/repo`. It verifies the 404 after deletion, recreates privately with the original issues/wiki settings, force-pushes the selected history and checks the remote SHA. A later failure never automatically retries deletion.

### Second device and safety boundaries

After a remote delete-and-recreate, the other device must back up its old clone, clone the rebuilt repository again and run `git lfs pull`. Verify the plugin binding and recovery key before resuming two-device sync.

Media commands require separately documented dependencies and must be run manually from the vault root; use Git Bash on Windows. Lossy conversion is irreversible: keep a cold backup, inspect outputs and update note links yourself. The public plugin repository is not a vault repository; PATs, recovery keys and vault contents are excluded from public source and release assets.

### Validation status and known limits

- Implementation commit `ba5eb9dc0d73bea94da5551570db653f9d9ae7f6` passed TypeScript, 23 test files / 101 tests and the production build. [Main CI 38865092891](https://github.com/luoboruodai/github-vault-sync/actions/runs/38865092891) passed on macOS and Windows with Node 22.
- macOS Obsidian 1.14.4 checks covered five settings pages, media preview/copy interactions, and rebuild preflight/confirmation gating. That rebuild acceptance was read-only and cancelled; it did not delete or recreate a repository.
- Six media sample commands were executed in Windows Git Bash CI during implementation. **Windows CI is not native Windows Obsidian GUI acceptance; native Windows GUI validation remains deferred.** Full multi-device attachment and restore scenarios still require environment-specific acceptance.

### Installation / upgrade

Download the single manual asset `github-vault-sync-0.2.0.zip`, not GitHub's automatic Source code archive. Save notes, back up the vault and exit Obsidian normally. Replace only the three runtime files in `.obsidian/plugins/github-vault-sync/` and **keep the existing local `data.json`**. Reopen Obsidian and confirm v0.2.0 in plugin settings. The ZIP includes the same [standalone English guide](install/README.md) and its Chinese counterpart.
