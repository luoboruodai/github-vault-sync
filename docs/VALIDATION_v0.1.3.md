# v0.1.3 validation and source closeout / 验证与源码收尾

**2026-10-14 · Unreleased source preview / 未发布的源码预览**

This record distinguishes source/build checks, native-host checks, and publication. The implementation and approved media were tested at source commit `bbbd5e2228e3c8ec8245f13be34450d5791a64a3`. The subsequent documentation closeout does not change the installed JavaScript, stylesheet, manifest, or approved video bytes. The public install Release remains v0.1.2; no v0.1.3 binary Release is implied.

本记录区分源码／构建、原生宿主验证和正式发布。实现与已批准媒体的测试基线为上述提交；其后的文档收尾不改变安装文件或视频字节。**源码进入 `main`、本机安装通过，不等于已发布 v0.1.3 安装包。**

## Completed checks / 已完成检查

| Layer / 层级 | Evidence and result / 证据与结果 | Limit / 边界 |
| --- | --- | --- |
| Local source / 本机源码 | `pnpm typecheck`, `pnpm test`, `pnpm build`: passed; 20 test files / 72 tests. | Temporary test repositories; not a production-vault sync. 临时仓库测试，不是真实笔记库同步。 |
| CI / 持续集成 | [Run 38526208776](https://github.com/luoboruodai/github-vault-sync/actions/runs/38526208776): macOS and Windows / Node 22 passed Git LFS availability, type checking, tests and build for `bbbd5e2`. | `main`/PR CI deliberately skips the unreleased ZIP check; release-tag CI enforces it. 开发分支不冒充发行包验证。 |
| Install identity / 安装身份 | A private, allowlisted QA archive passed member, CRC and source-byte checks; the three installed plugin files matched the build. | Private QA only, not a public distribution ZIP. 不公开备份或私有候选包。 |
| macOS host / macOS 宿主 | Obsidian 1.14.4 restarted normally after save confirmation; native settings showed v0.1.3. Mouse navigation selected each of the four tabs and exposed only its corresponding panel. | Basic smoke check, not every theme, keyboard path, UI animation or failure case. 基础验收，不代表全场景通过。 |
| Configuration / 配置迁移 | Schema 1 → 2 matched the expected migration; normalizing again required no rewrite. Existing credentials, recovery key and repository binding were preserved; local `data.json` permissions remained `0600`. | macOS observation, not a Windows ACL guarantee. 私有配置内容未公开。 |
| Encrypted configuration / 加密配置 | Read-only inspection authenticated the current local bundle with the existing recovery key, without rewriting settings or ciphertext. | Not a restore, conflict resolution or multi-device round trip. 不等于恢复／双端合并验收。 |
| Documentation media / 文档媒体 | Three approved MP4 hashes matched the committed files; decoding and browser playback passed. GitHub rendering retained the direct links but filtered the HTML video players. | Illustrative UI motion using sample data, not live Obsidian recordings. 演示不替代宿主验收。 |

The CI workflow attached to each later commit remains the authority for that commit's source/build result. The run linked above is evidence for its exact SHA, not a promise that future changes are already tested.

后续提交须查看其各自 CI 结果，不能把旧提交的通过记录转用于改动后的代码。

## Remaining acceptance / 尚未完成的验收

- Native Windows Obsidian second-device setup, recovery ordering and attachment use in the user's target environment. **Windows CI is not Windows GUI acceptance.** 原生 Windows 第二设备验收仍待完成。
- Actual corporate/authenticated proxy policies, host-specific Git/LFS behavior and full multi-device attachment review. Earlier isolated/local checks do not establish these environments. 实际企业代理和完整多设备附件检查不能由本机模拟代替。
- A real-vault upload, encrypted conflict choice or restore is outside this smoke check; each requires its own preview, backup and explicit authorization. No upload was performed just to clear pending differences. 不为清空待同步状态自动选择密文版本。
- Before any v0.1.3 distribution, review the final archive's standalone instructions and links. The current archive allowlist does not include `docs/` or media, so repository-relative documentation/video links must be adapted or clearly identified as online-only. Verify the final archive, release-tag CI and downloaded bytes after any separately authorized release. **Do not relabel or move v0.1.2.** 正式发布前还需检查最终包、离线说明、标签 CI 与附件回读。

## Handoff and privacy / 交接与隐私

Public handoff: [development history](PROJECT_HISTORY.md), [draft release notes](RELEASE_NOTES_v0.1.3.md), and [second-device engineering notes](SECOND_DEVICE_DEBUG_v0.1.3.md). Private host screenshots, user notes, configuration, keys, backups and detailed local handoff records are intentionally excluded from Git. A local package upgrade does not authorize syncing the user's private vault.

公开记录仅保留脱敏结论和可公开的提交／CI 身份。真实 Vault、原始对话截图、配置、密钥、备份与本地交接记录留在本机私有区；它们不会因为项目收尾而进入公开仓库。
