# v0.1.3 validation and source closeout / 验证与源码收尾

**2026-10-14 · v0.1.3 release validation scope / 发布验证范围**

This record distinguishes source/build checks, native-host checks, and publication. The implementation and approved media were tested at source commit `bbbd5e2228e3c8ec8245f13be34450d5791a64a3`. The release preparation changes documentation, archive tooling and packaging tests, not the host-verified JavaScript, stylesheet, manifest or approved video bytes. v0.1.3 is released with the native Windows/environment-specific limits below disclosed, not counted as passed. The existing v0.1.2 tag and assets remain unchanged.

本记录区分源码／构建、原生宿主验证和正式发布。实现与已批准媒体的测试基线为上述提交；发布准备只调整文档、打包工具与回归测试，不改变已验收插件运行文件。**本次按明确授权发布 v0.1.3，并披露尚未完成的 Windows 原生／环境专项验收，不把它们算作通过。**

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

## Distribution checks / 正式分发检查

The repository README is no longer copied into the ZIP. The fixed source-to-archive mapping installs the two guides under `docs/install/` as `README.md` / `README.zh-CN.md`; cross-language links work inside the extracted package, while videos and engineering records use explicit online links pinned to v0.1.3. The package verifier checks all six members (one directory plus five files), CRC, source-byte equality, guide versions and packaged relative-link targets. A failed candidate is rejected before replacing an existing valid ZIP.

安装包现采用独立双语说明，避免解压后指向不存在的仓库目录。新增七项打包回归测试（纳入 `pnpm test`）检查包成员、版本、字节、可重复构建、包外链接、陈旧指南及失败回退；不把“成功压缩”误作可安装验证。 本次发布准备的本机类型检查、**21 个测试文件／79 项测试**和生产构建均通过；七项新增测试不改变此前的插件宿主验收构建。

The release preparation passed local type checking, **21 test files / 79 tests**, and the production build. The seven additional archive tests do not change the host-verified plugin runtime.

Publication gates for the exact release commit: local tests and production build; macOS/Windows branch CI; a new v0.1.3 tag without moving older tags; macOS/Windows **tag CI including archive verification**; and SHA-256 readback of the uploaded Release asset. The Release description records the final run identities and archive checksum after these checks. Old source-only CI above is historical evidence and is not substituted for the release-tag checks.

最终 Release 说明记录本次发布提交对应的 CI 与 ZIP 校验值。主分支跳过 ZIP 检查不算发行包通过，必须另外核实本版标签 CI 和附件下载字节。v0.1.2 标签、历史 Release 和附件保持原样。


## Handoff and privacy / 交接与隐私

Public handoff: [development history](PROJECT_HISTORY.md), [release notes](RELEASE_NOTES_v0.1.3.md), and [second-device engineering notes](SECOND_DEVICE_DEBUG_v0.1.3.md). Private host screenshots, user notes, configuration, keys, backups and detailed local handoff records are intentionally excluded from Git. A local package upgrade does not authorize syncing the user's private vault.

公开记录仅保留脱敏结论和可公开的提交／CI 身份。真实 Vault、原始对话截图、配置、密钥、备份与本地交接记录留在本机私有区；它们不会因为项目收尾而进入公开仓库。
