# GitHub Vault Sync

[简体中文](README.zh-CN.md)

**v0.2.0 (under development; not yet released):** adds non-blocking media optimization advice to the full sync preview, a fifth settings page for media rules, guarded conversion commands, and AVIF Git LFS migration. The latest installable release remains v0.1.3.

**v0.1.3 (2026-10-14):** safer second-device bootstrap, legacy settings migration, encrypted-restore ordering, Git LFS hydration, repository-scoped proxy diagnostics and older-Electron CSS fallbacks. Download the single [v0.1.3 installation ZIP](releases/github-vault-sync-0.1.3.zip). Native Windows second-device acceptance is still pending; see the [validation scope and known limits](docs/VALIDATION_v0.1.3.md).

 · [Developer history](docs/PROJECT_HISTORY.md)

**GitHub Vault Sync** is an Obsidian desktop plugin for synchronizing a vault with a **separate private GitHub repository**. This public repository contains only the plugin's source code and distributable releases. **Do not use this public repository for your notes or credentials.**

## UI motion tour (v0.1.3)

These short **illustrative UI-motion demos** use the plugin stylesheet and representative settings/preview markup with sample data. They show state changes, preview-first conflict review, and encrypted-settings boundaries; they are not recordings of a live Obsidian session and do not perform a sync. The approved videos are H.264 MP4 files at 1280×720 and 30 fps. On GitHub, use the direct MP4 links; Markdown viewers that allow HTML video may also show the inline player.

### Status flow: local changes → remote check → preview → complete

[Watch the status-flow MP4](docs/media/overview-b-status-flow.mp4) · 4.8s

<video controls preload="metadata" width="720" style="max-width:100%;height:auto">
  <source src="docs/media/overview-b-status-flow.mp4" type="video/mp4">
  Video playback is not supported in this viewer; use the link above.
</video>

### Preview → choose → confirm

[Watch the preview-flow MP4](docs/media/safe-sync-a-preview.mp4) · 7.2s

<video controls preload="metadata" width="720" style="max-width:100%;height:auto">
  <source src="docs/media/safe-sync-a-preview.mp4" type="video/mp4">
  Video playback is not supported in this viewer; use the link above.
</video>

### Encrypted-settings boundary

[Watch the encrypted-boundary MP4](docs/media/recovery-c-encrypted-boundary.mp4) · 4.8s

<video controls preload="metadata" width="720" style="max-width:100%;height:auto">
  <source src="docs/media/recovery-c-encrypted-boundary.mp4" type="video/mp4">
  Video playback is not supported in this viewer; use the link above.
</video>

## Install the v0.1.3 release

v0.1.3 retains note-first sync, preview-before-upload and four independent settings pages. It hardens second-device encryption and Git/LFS setup, migrates legacy safety rules, and adds repository-scoped proxy diagnostics. See the [release notes](docs/RELEASE_NOTES_v0.1.3.md) and [standalone install/upgrade guide](docs/install/README.md).

1. Back up your Obsidian vault. Install Git; install Git LFS before syncing images or other attachments matched by the plugin's LFS rules.
2. Open this project's GitHub **Releases** page and download `github-vault-sync-0.1.3.zip`. The **only manually uploaded release asset** is this ZIP; the same file is kept in [`releases/github-vault-sync-0.1.3.zip`](releases/github-vault-sync-0.1.3.zip). GitHub’s automatic “Source code (zip/tar.gz)” downloads are **not** installable plugin bundles because the project root omits the compiled `main.js`.
3. Save your notes and exit Obsidian normally, then extract the ZIP into `<Vault>/.obsidian/plugins/`. The resulting files must be:

   ```text
   <Vault>/.obsidian/plugins/github-vault-sync/manifest.json
   <Vault>/.obsidian/plugins/github-vault-sync/main.js
   <Vault>/.obsidian/plugins/github-vault-sync/styles.css
   ```

   On Windows, a typical destination is `C:\Users\<you>\Documents\YourVault\.obsidian\plugins\github-vault-sync\`; on macOS, it is `<Vault>/.obsidian/plugins/github-vault-sync/`. **When updating, keep the existing local `data.json`** rather than replacing the entire plugin directory.

   Avoid an extra nested `github-vault-sync/github-vault-sync/` directory. The ZIP already contains every plugin file and bilingual setup instructions: no separate Release downloads, Node.js, or pnpm are needed for manual installation. Git and, where applicable, Git LFS remain separate **system prerequisites**. The ZIP contains no tokens, recovery keys, or personal vault data.
4. Open Obsidian again. In **Settings → Community plugins**, enable **GitHub Vault Sync**. Requires Obsidian desktop **1.13.0+** on **Windows or macOS** (Linux desktop is also supported); mobile Obsidian is not supported. The same ZIP is used for both Windows and macOS.

If you already use a local pre-release labeled `0.4.0`, public `0.1.0` was the **first public release**; `0.1.3` continues that public series and is not a downgrade or upgrade of the internal `0.4.0` build. You need not replace your working installation merely to download the public package. Back up your vault before any manual replacement and leave local `data.json` in place.

## Connect your own private vault repository

1. In plugin settings, connect GitHub using a repository-scoped personal access token (PAT) with read/write permission for **your private vault repository**. Do not paste the PAT into this public repository or a chat. Browser Device Flow is available if you supply your own GitHub OAuth App Client ID.
2. Create or bind an **existing private vault repository** in the plugin. Select the intended `main` branch and review the first-binding preview. This public plugin repository is **not** the vault repository.
3. Keep a separate local vault backup. Do not run another actively configured vault-sync plugin against the same files at the same time.

## Synchronize notes safely

Select **Preview and sync** in plugin settings or the Sync Center. Before any upload, the plugin compares the local working tree and fetched remote commit, grouping changes in this order: (1) Markdown notes, (2) note-folder attachments, (3) Obsidian plugin/settings and encrypted snapshots, (4) other files. A note changed on both devices can be viewed side by side.

**Choose one conflict policy for that run:** prefer this device, prefer the repository, or review each note. The priority applies **only when the same Markdown path changed on both sides**. Independent changes are merged; plugin configurations, encrypted archives, and binary attachments require file-level review. The losing Markdown version is saved locally under `.github-vault-sync-conflicts/`, which is not uploaded. File times can help review, but clock times do not prove which text is newest. If local content or the remote commit changes after preview, the plugin rejects the stale approval and asks you to preview again. No force push is performed.

Progress shows verified staging file counts and Git/LFS object progress where Git reports it; otherwise the transfer indicator remains indeterminate rather than inventing a percentage. **Timely checking** notices local changes after a configurable delay (default 90 seconds) and checks GitHub every five minutes. It **never uploads without your explicit preview and confirmation**.

## Media optimization before upload (v0.2.0 development)

During a full sync preview, the development build lists included PNG/JPG/JPEG, PDF, MP4, and GIF files larger than the configurable threshold. These suggestions **never block synchronization**, and the plugin does not execute the conversions. The **Media optimization** settings page controls the threshold (default 2 MB), media-only glob exclusions, the image PSNR floor (default 35 dB), and whether estimated savings are shown.

Each finding has a **Copy conversion command** action. Run the copied command from the vault root in a terminal; on Windows use Git Bash. Images require Pillow and `pillow-avif-plugin`, PDFs require Ghostscript, MP4 commands require FFmpeg with `libsvtav1`, and GIF commands require FFmpeg with `libwebp`. PNG starts at AVIF q70 and JPG at q60; the command then tries higher quality steps through q100 until the configured PSNR floor is met. If the floor still cannot be met, it leaves no converted file. Existing destinations are not overwritten, and colliding output names receive a short hash.

PDF commands use Ghostscript `/ebook`, MP4 commands use AV1, and GIF commands produce animated WebP. Estimated savings are projections from the measured vault samples, not guarantees for a particular file. Lossy replacement is irreversible: keep a cold backup, inspect the generated files, update note links yourself, and open a fresh sync preview afterward. AVIF is included in the default Git LFS rules and is added once when migrating pre-0.2.0 settings.

## Encrypted plugin settings and recovery key

Plugin `data.json`, credential dotfiles, and explicitly excluded exceptional plugin directories are **never committed as plaintext**. If enabled, client-side AES-256-GCM encryption stores their backed-up contents in `.github-vault-sync-encrypted/vault.gvs`. The encryption key is local only. Open **View and copy recovery key** to reveal it in a modal and copy it; closing the modal hides the displayed value. Keep an independent, secure copy **outside your vault and outside GitHub**. Anyone with both the encrypted repository and the key can decrypt its plugin credentials; losing the key makes the encrypted copy unrecoverable.

On another desktop device, install this plugin, bind the same private repository, import the recovery key locally, pull the encrypted bundle, then choose **Restore encrypted settings**. New recovery keys and restore backups default to the current user’s `Library/Application Support/github-vault-sync-backups/` on macOS, `%APPDATA%\github-vault-sync-backups\` on Windows, and the XDG user data directory on Linux. Keep the Vault and its local `data.json` protected by your OS account permissions; Windows ACLs are not equivalent to Unix `chmod`. Restoration first backs up files that would be overwritten and preserves the current device's GitHub login by default. Restart Obsidian afterward. Incoming encrypted or executable plugin changes pause automatic processing until reviewed.

## Cross-platform verification

The macOS/Windows CI runs TypeScript checks, temporary local Git/Git LFS integration tests, and a production build. **Release-tag CI also checks that the ZIP matches the built files; `main`/PR development builds do not require an unreleased ZIP.** This is not a Windows Obsidian GUI session or a guarantee for every third-party theme or Git installation. The separate macOS host smoke check covered the running v0.1.3 version, four settings pages, and safe settings migration, not a live sync or restore. See the [validation scope](docs/VALIDATION_v0.1.3.md); report host-specific issues with the Obsidian version, OS, and non-secret diagnostic details. No real vault or GitHub token is used in CI.

## Build from source

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

The build creates `main.js` in the project root; release maintainers can run `python scripts/release_archive.py build` to create and verify the allowlisted ZIP. The ZIP uses the independent bilingual guides under `docs/install/`, not these repository READMEs; its online video/documentation links point to the release tag. Only `manifest.json`, `main.js`, and `styles.css` belong in an installed plugin folder. For the ready-to-install package use the single [release ZIP](releases/github-vault-sync-0.1.3.zip) instead. See [the developer handoff](docs/PROJECT_HISTORY.md) for architecture, design decisions, tests, and the public-safe development conversation timeline.

## Security note

A private repository is not an encryption key or an offline backup. Review changes before upload, respect Git LFS limits, and keep your recovery key outside both repositories. The current source scan is heuristic, not a formal guarantee that arbitrary notes or third-party plugin code cannot contain secrets. This project does not transmit your vault to the public plugin repository.
