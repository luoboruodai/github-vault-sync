# GitHub Vault Sync v0.2.0 — Install and upgrade

[简体中文](README.zh-CN.md)

This ZIP contains the complete Obsidian desktop plugin and these instructions. **Back up your vault before installing or upgrading.** It does not contain your settings, credentials or notes.

## Requirements

- Obsidian **desktop 1.13.0 or later**; Windows and macOS use the same ZIP. Mobile is not supported. Linux desktop is supported by the code but has not received native-host acceptance for this release.
- Install system **Git**, plus **Git LFS** before syncing attachments matched by the LFS rules. These are separate prerequisites, not included in the ZIP. Node.js, npm and pnpm are not needed to run the plugin.
- Use your own **separate private GitHub repository** for the vault. Do not bind the public plugin source repository as your vault repository.

## First installation

1. Save open notes, back up the vault, and exit Obsidian normally.
2. Extract this ZIP into `<Vault>/.obsidian/plugins/`. The ZIP already has a single `github-vault-sync/` folder. The installed layout must be:

   ```text
   <Vault>/.obsidian/plugins/github-vault-sync/manifest.json
   <Vault>/.obsidian/plugins/github-vault-sync/main.js
   <Vault>/.obsidian/plugins/github-vault-sync/styles.css
   ```

   Avoid an extra `github-vault-sync/github-vault-sync/` nesting. The two README files are optional instructions, not runtime dependencies.
3. Open Obsidian, enable **GitHub Vault Sync** in **Settings → Community plugins**, then open its settings and confirm **v0.2.0**.
4. Connect with credentials scoped to your private vault repository and review the initial binding plan. Keep PATs and recovery keys out of chats and the public source repository.

On Windows the destination is typically `%USERPROFILE%\Documents\YourVault\.obsidian\plugins\github-vault-sync\`; substitute your actual vault path.

## Upgrade an existing installation

1. Save notes and exit Obsidian normally; do not use a reload action that discards edits.
2. Back up the current plugin files **and its local `data.json` outside the vault**, with access limited to your OS user account. That settings file may contain a PAT and recovery key.
3. Copy only `manifest.json`, `main.js` and `styles.css` from this package into the existing plugin directory. **Do not delete or replace your existing `data.json`.** Do not replace the entire vault or plugin directory.
4. Reopen Obsidian and verify the running version in plugin settings. v0.2.0 migrates older settings to schema 3, adds AVIF to the Git LFS rules once, and may refresh the local encrypted snapshot. A changed file hash after loading can therefore be legitimate; keep the backup and inspect unexpected changes.
5. Upgrade-related file or encrypted-bundle changes are not permission to upload. Preview the local and remote differences first, especially when the encrypted bundle has changed on both devices. Do not run competing vault-sync plugins against the same files.

## Preview-first sync and recovery

- **Preview and sync** requires an explicit confirmation. Automatic checks notify you of differences; they do not automatically upload the vault. Conflict preferences apply only to Markdown paths changed on both sides; attachments and plugin/configuration files require separate review.
- Media optimization only suggests commands; it never blocks sync or converts files by itself. If you choose to run them, install the documented Pillow/AVIF, Ghostscript and FFmpeg dependencies, keep a cold backup, inspect the outputs and update note links yourself.
- On a second device, bind the same private repository and obtain the remote encrypted bundle before creating a new local snapshot. Import your recovery key locally and review the restore action; do not upload an empty bundle over the remote one.
- After a remote delete-and-recreate, the other device must first back up its old clone, clone the rebuilt repository again and run `git lfs pull`. Verify the plugin binding and recovery key before resuming two-device sync.
- Keep the recovery key securely **outside the vault and GitHub**. Restoring encrypted settings first makes a backup and preserves this device's login by default. Review any downloaded executable plugin code and restart Obsidian after an approved restore.
- If startup fails after upgrading, exit Obsidian normally before restoring the saved installation files. Restore settings only from your own verified backup and never discard newer user edits merely to make a version number match.

## Verified scope and limitations

The v0.2.0 implementation passed local TypeScript checks, 23 test files / 101 tests and a production build. macOS Obsidian 1.14.4 host checks covered the running version, five settings tabs, media preview/copy interactions and read-only remote-rebuild confirmation gating. Windows Git Bash sample conversion commands were exercised separately in CI. The release workflow checks source/build/archive consistency on macOS and Windows. **Windows CI is not native Windows Obsidian GUI or second-device acceptance; native Windows Obsidian GUI validation remains deferred.** Corporate/authenticated proxy networks and full multi-device attachment/restore scenarios remain environment-dependent and are not claimed as fully validated.

The videos and engineering records are **online-only**, deliberately excluded from this installation ZIP:

- [Versioned UI tour and full guide (online)](https://github.com/luoboruodai/github-vault-sync/blob/v0.2.0/README.md)
- [Versioned validation record (online)](https://github.com/luoboruodai/github-vault-sync/blob/v0.2.0/docs/VALIDATION_v0.2.0.md)
- [v0.2.0 Release (online)](https://github.com/luoboruodai/github-vault-sync/releases/tag/v0.2.0)

Download `github-vault-sync-0.2.0.zip` from that Release. GitHub's automatic **Source code** archives omit the built runtime and are not installable plugin packages.
