# GitHub Vault Sync

[简体中文](README.zh-CN.md) · [Developer history](docs/PROJECT_HISTORY.md)

**GitHub Vault Sync** is an Obsidian desktop plugin for synchronizing a vault with a **separate private GitHub repository**. This public repository contains only the plugin's source code and distributable releases. **Do not use this public repository for your notes or credentials.**

## Install the v0.1.0 release

1. Back up your Obsidian vault. Install Git; install Git LFS before syncing images or other attachments matched by the plugin's LFS rules.
2. Open this project's GitHub **Releases** page and download `github-vault-sync-0.1.0.zip`. The same ZIP and standalone assets are archived in [`releases/v0.1.0/`](releases/v0.1.0/).
3. Extract the ZIP into `<Vault>/.obsidian/plugins/`. The resulting files must be:

   ```text
   <Vault>/.obsidian/plugins/github-vault-sync/manifest.json
   <Vault>/.obsidian/plugins/github-vault-sync/main.js
   <Vault>/.obsidian/plugins/github-vault-sync/styles.css
   ```

   Avoid an extra nested `github-vault-sync/github-vault-sync/` directory. The ZIP contains no tokens, recovery keys, or personal vault data.
4. Restart Obsidian. In **Settings → Community plugins**, enable **GitHub Vault Sync**. Requires Obsidian desktop **1.13.0+**; mobile Obsidian is not supported.

If you already use a local pre-release labeled `0.4.0`, the public `0.1.0` is the **first public release of the same project, not a higher-version update**. You need not replace your working installation merely to download the public package. Back up your vault before any manual replacement and leave local `data.json` in place.

## Connect your own private vault repository

1. In plugin settings, connect GitHub using a repository-scoped personal access token (PAT) with read/write permission for **your private vault repository**. Do not paste the PAT into this public repository or a chat. Browser Device Flow is available if you supply your own GitHub OAuth App Client ID.
2. Create or bind an **existing private vault repository** in the plugin. Select the intended `main` branch and review the first-binding preview. This public plugin repository is **not** the vault repository.
3. Keep a separate local vault backup. Do not run another actively configured vault-sync plugin against the same files at the same time.

## Synchronize notes safely

Select **Preview and sync** in plugin settings or the Sync Center. Before any upload, the plugin compares the local working tree and fetched remote commit, grouping changes in this order: (1) Markdown notes, (2) note-folder attachments, (3) Obsidian plugin/settings and encrypted snapshots, (4) other files. A note changed on both devices can be viewed side by side.

**Choose one conflict policy for that run:** prefer this device, prefer the repository, or review each note. The priority applies **only when the same Markdown path changed on both sides**. Independent changes are merged; plugin configurations, encrypted archives, and binary attachments require file-level review. The losing Markdown version is saved locally under `.github-vault-sync-conflicts/`, which is not uploaded. File times can help review, but clock times do not prove which text is newest. If local content or the remote commit changes after preview, the plugin rejects the stale approval and asks you to preview again. No force push is performed.

Progress shows verified staging file counts and Git/LFS object progress where Git reports it; otherwise the transfer indicator remains indeterminate rather than inventing a percentage. **Timely checking** notices local changes after a configurable delay (default 90 seconds) and checks GitHub every five minutes. It **never uploads without your explicit preview and confirmation**.

## Encrypted plugin settings and recovery key

Plugin `data.json`, credential dotfiles, and explicitly excluded exceptional plugin directories are **never committed as plaintext**. If enabled, client-side AES-256-GCM encryption stores their backed-up contents in `.github-vault-sync-encrypted/vault.gvs`. The encryption key is local only. Open **View and copy recovery key** to reveal it in a modal and copy it; closing the modal hides the displayed value. Keep an independent, secure copy **outside your vault and outside GitHub**. Anyone with both the encrypted repository and the key can decrypt its plugin credentials; losing the key makes the encrypted copy unrecoverable.

On another desktop device, install this plugin, bind the same private repository, import the recovery key locally, pull the encrypted bundle, then choose **Restore encrypted settings**. Restoration first backs up files that would be overwritten and preserves the current device's GitHub login by default. Restart Obsidian afterward. Incoming encrypted or executable plugin changes pause automatic processing until reviewed.

## Build from source

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The build creates `main.js` in the project root; only `manifest.json`, `main.js`, and `styles.css` belong in an installed plugin folder. For the ready-to-install package use [Releases](releases/v0.1.0/) instead. See [the developer handoff](docs/PROJECT_HISTORY.md) for architecture, design decisions, tests, and the public-safe development conversation timeline.

## Security note

A private repository is not an encryption key or an offline backup. Review changes before upload, respect Git LFS limits, and keep your recovery key outside both repositories. The current source scan is heuristic, not a formal guarantee that arbitrary notes or third-party plugin code cannot contain secrets. This project does not transmit your vault to the public plugin repository.
