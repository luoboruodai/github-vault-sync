# Second-device deployment debug notes for v0.1.3

This is a sanitized public engineering summary derived from a private second-device deployment report. The original PDF, credentials, local paths, screenshots, and Vault contents remain private and are not included in this repository.

## Reproducible findings

1. **Auth is not the same as Git transport**. GitHub API requests can succeed while `git fetch` or Git LFS requests fail with connection resets. A failure after a successful clone is not automatically a PAT failure.
2. **A second device must be remote-first** when its Vault is empty. It must not create and upload a new encrypted bundle before checking whether the remote already has the authoritative bundle.
3. **Encrypted device identity differs by design**. PAT and local OAuth identity must not make otherwise equal encrypted configuration snapshots appear different on every device.
4. **Git LFS needs explicit hydration**. A machine with Git LFS installed but without initialized filters can clone pointer text instead of real attachments.
5. **Legacy policy drift is dangerous**. An older `.github-vault-sync.json` can omit current credential exclusions and allow plaintext plugin settings to be tracked.
6. **The host can rewrite settings schemas on restart**. An Obsidian core-plugin configuration must be treated as a mapping of plugin IDs to boolean values when that is the schema observed on the target host; key presence alone does not mean enabled.
7. **CSS support differs across Electron shells**. `color-mix()` and reduced-motion behavior should have scoped fallbacks; identical themes do not prove identical rendered CSS.

## Implemented v0.1.3 direction

- Normalize mandatory exclusions during plugin startup while retaining user additions.
- Fetch and validate the remote before creating a local encrypted bundle; restore-first remains the safe second-device order.
- Keep device-local credentials out of the encrypted digest, preserving explicit full-login restore compatibility and legacy digest reads.
- Clone without LFS smudge, then install local filters and pull LFS objects; report a clear dependency error if pointers cannot be hydrated.
- Add a per-repository Git proxy setting and transport-specific error guidance.
- Record error timestamps and show them in the sync summary; add a specific error for plaintext remote plugin configuration.
- Preserve a fallback visual system when `color-mix()` is unavailable.

## Verification boundaries

The source tests can exercise temporary Git repositories, encryption, policy migration, proxy argument construction, and stale-preview guards. CI can verify Node/Git/LFS behavior on Windows and macOS. Neither replaces a native Obsidian GUI session on every platform, a real corporate proxy, or a full multi-device LFS visual review.

For the checks actually completed on 2026-10-14, including macOS host validation and the still-pending native Windows second-device work, see the [v0.1.3 validation record](VALIDATION_v0.1.3.md). Do not treat a successful CI job or a macOS host check as Windows GUI acceptance.
