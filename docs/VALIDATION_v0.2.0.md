# v0.2.0 validation and release scope / 验证与发布范围

**2026-10-16 · v0.2.0 release validation / 发布验证**

This record separates implementation checks, native-host evidence, packaging and publication. The implementation baseline is `ba5eb9dc0d73bea94da5551570db653f9d9ae7f6`. Release preparation changes documentation and the allowlisted archive, not the reviewed plugin source. Native Windows Obsidian GUI acceptance is explicitly deferred, not counted as passed.

本记录区分源码／构建、原生宿主、安装包和正式发布证据。实现基线为上述提交；发布准备只调整文档与白名单安装包，不修改已验收插件源码。**Windows 原生 Obsidian GUI 验收继续延期，不写作已通过。**

## Completed checks / 已完成检查

| Layer / 层级 | Evidence and result / 证据与结果 | Limit / 边界 |
| --- | --- | --- |
| Local source / 本机源码 | `pnpm typecheck`, `pnpm test`, `pnpm build`: passed; 23 test files / 101 tests. Production `main.js` is 247,365 bytes with SHA-256 `0b784a5258950ac174c197d20a964d3b0aa53c38710a85d56b48e94abc56eb8c`. | Temporary repositories and host checks do not prove every user environment. 临时仓库与宿主检查不覆盖所有环境。 |
| Main CI / 主分支持续集成 | [Run 38865092891](https://github.com/luoboruodai/github-vault-sync/actions/runs/38865092891): macOS and Windows / Node 22 passed Git LFS availability, type checking, tests and build for `ba5eb9d`. | Development CI deliberately skips the unreleased ZIP check; tag CI must verify it separately. 开发分支不冒充发行包验证。 |
| Windows media commands / Windows 媒体命令 | [Run 38791534866](https://github.com/luoboruodai/github-vault-sync/actions/runs/38791534866) executed six image/PDF/video/GIF sample commands in Windows Git Bash during media implementation, including decode, quality and no-overwrite checks. | Implementation-stage evidence for `0f22049`; not a Windows Obsidian GUI session. 实现阶段证据，不是原生界面验收。 |
| macOS host / macOS 宿主 | Obsidian 1.14.4 loaded v0.2.0; native checks covered five settings pages, media preview and copy-all/copy-state interactions, scroll count/loading, and safe settings migration. The user also confirmed the local test result. | Not every theme, platform or failure case. 不代表所有主题、平台和异常场景。 |
| Rebuild safety / 重建安全 | Native preflight showed the private repository and verified bundle; the dangerous button remained disabled until all confirmations and the exact repository name were present. The check then cancelled without deletion. State-machine tests cover recreate/push failure stages. | This specific host acceptance did not execute deletion, recreation or a real push. 本次验收未执行真实删除、重建或推送。 |
| Package / 安装包 | Fixed mapping: one `github-vault-sync/` directory plus `manifest.json`, `main.js`, `styles.css`, `README.md`, `README.zh-CN.md`. Verification covers members, CRC, source-byte identity, manifest/package/versions and standalone guide links. | GitHub automatic Source code archives are not installable plugin packages. 自动源码包不是安装包。 |

Later commits and tags must use their own CI results. A green run for an older SHA is not evidence for changed code.

后续提交和标签必须核对各自 CI，旧 SHA 的通过记录不能转用于改动后的代码。

## Remaining acceptance / 尚未完成的验收

- Native Windows Obsidian GUI behavior remains deferred by user decision. Windows CI and Git Bash command tests are useful but do not replace the host GUI. **Windows 原生 Obsidian GUI 验收延期。**
- After an actual remote delete-and-recreate, the second device must back up its old clone, clone again and run `git lfs pull`, then verify plugin binding and the recovery key before sync resumes. Publishing this plugin does not complete those device-specific steps. **发布插件不等于第二设备已恢复验收。**
- Corporate/authenticated proxies, every third-party theme, and full multi-device attachment/restore combinations remain environment-dependent. 企业代理、所有主题及完整多设备组合仍需实机验证。

## Distribution and publication gates / 分发与发布门槛

The standalone guides use versioned online links and work as a bilingual pair inside the ZIP; no repository-only relative media is bundled. A candidate archive is verified before it can replace an existing valid package. The final SHA-256 and download identity are recorded on the GitHub Release.

独立指南在 ZIP 内可双语互链，在线资料固定到 v0.2.0；候选包通过成员、CRC、版本和字节检查后才可成为正式包。最终 SHA-256 与下载回读结果记录在 GitHub Release。

Publication requires the reviewed release PR and its macOS/Windows CI, a frozen `main` commit, a new immutable v0.2.0 tag, tag CI that actually runs archive verification, and a Release asset download whose bytes match the frozen ZIP. Older tags and Release assets must remain unchanged.

发布须经过发布 PR 与双平台 CI、冻结的 `main` 提交、新的 v0.2.0 标签、实际执行安装包检查的标签 CI，以及 Release 附件下载字节回读。旧标签与历史附件保持不变。

## Handoff and privacy / 交接与隐私

Public handoff: [development history](PROJECT_HISTORY.md), [release notes](RELEASE_NOTES_v0.2.0.md), and the [standalone install guide](install/README.md). Private host screenshots, user notes, configuration, keys, backups and detailed local handoff records are intentionally excluded from Git. Installing or publishing the plugin does not authorize syncing a private vault.

公开记录仅保留脱敏结论和可公开的提交／CI 身份。真实 Vault、原始截图、配置、密钥、备份与详细本地交接记录留在私有区；安装或发布插件不构成同步私人笔记库的授权。
