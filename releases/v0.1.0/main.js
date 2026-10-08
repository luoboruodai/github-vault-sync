/* GitHub Vault Sync */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GithubVaultSyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");
var import_node_path7 = __toESM(require("node:path"));
var import_node_fs6 = require("node:fs");

// src/encrypted-bundle.ts
var import_node_crypto2 = require("node:crypto");
var import_node_fs2 = require("node:fs");
var import_node_os = __toESM(require("node:os"));
var import_node_path2 = __toESM(require("node:path"));
var import_node_zlib = require("node:zlib");

// src/utils.ts
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"));

// src/types.ts
var SYNC_MANIFEST = ".github-vault-sync.json";
var GIT_ATTRIBUTES = ".gitattributes";
var DEFAULT_BRANCH = "main";
var DEFAULT_EXCLUDE_PATTERNS = [
  ".git/**",
  ".trash/**",
  ".obsidian/workspace*.json",
  ".obsidian/cache/**",
  "**/*.log",
  ".github-vault-sync-conflicts/**",
  ".github-vault-sync-encrypted/*.tmp-*",
  ".obsidian/plugins/github-vault-sync/data.json",
  // Plugin configuration may contain tokens with unrecognized key names.
  ".obsidian/plugins/**/data.json",
  "**/.npmrc",
  "**/.netrc",
  "**/.pypirc",
  "**/.env",
  "**/.env.*"
];
var DEFAULT_LFS_PATTERNS = [
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.webp",
  "*.bmp",
  "*.tif",
  "*.tiff",
  "*.svg",
  "*.pdf",
  "*.mp4",
  "*.mov",
  "*.mkv",
  "*.avi",
  "*.webm",
  "*.mp3",
  "*.wav",
  "*.flac",
  "*.m4a",
  "*.zip",
  "*.7z",
  "*.rar",
  "*.ai",
  "*.psd",
  "*.blend",
  "*.c4d",
  "*.exr",
  "*.glb",
  "*.gltf"
];
var DEFAULT_SETTINGS = {
  schemaVersion: 1,
  oauthClientId: "",
  token: "",
  authType: null,
  repo: null,
  startupCheck: true,
  autoSyncEnabled: false,
  autoSyncDelaySeconds: 90,
  encryptedSyncEnabled: false,
  encryptionKey: "",
  encryptedFolders: [],
  encryptionLastDigest: "",
  includeObsidian: true,
  branch: DEFAULT_BRANCH,
  excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
  lfsPatterns: [...DEFAULT_LFS_PATTERNS],
  conflictFolder: ".github-vault-sync-conflicts",
  gitUserName: "GitHub Vault Sync",
  gitUserEmail: "github-vault-sync@users.noreply.github.com",
  lastRemoteSha: "",
  lastStatus: "unconfigured",
  lastError: "",
  pendingMerge: null,
  logEntries: []
};

// src/utils.ts
var TEXT_EXTENSIONS = /* @__PURE__ */ new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".css",
  ".scss",
  ".less",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".html",
  ".htm",
  ".xml",
  ".svg",
  ".csv",
  ".tsv",
  ".toml",
  ".ini",
  ".conf",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".tex",
  ".log",
  ".gitignore",
  ".gitattributes"
]);
var SENSITIVE_KEY_RE = /(?:api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|private[_-]?key)\s*["'`]?\s*[:=]/i;
var TOKEN_VALUE_RE = /(?:ghp_|gho_|ghs_|ghu_|github_pat_|sk-[A-Za-z0-9_-]{12,})/;
var PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
var LITERAL_TOKEN_RE = /(?:^|[^A-Za-z0-9_-])(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,})/;
var LITERAL_SECRET_ASSIGNMENT_RE = /(?:api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[\"'`]?\s*[:=]\s*[\"'`]([A-Za-z0-9_+/-]{24,})[\"'`]/i;
var WINDOWS_RESERVED = /* @__PURE__ */ new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
]);
function normalizeRelPath(value) {
  return value.split("\\").join("/").replace(/^\.\//, "").replace(/\/+/g, "/");
}
function isSafeRelativePath(value) {
  const normalized = normalizeRelPath(value);
  return Boolean(normalized) && !normalized.startsWith("/") && !normalized.split("/").includes("..");
}
function globToRegExp(pattern) {
  const normalized = normalizeRelPath(pattern).replace(/\/$/, "");
  let source = "";
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === "*") {
      if (normalized[i + 1] === "*") {
        i += 1;
        if (normalized[i + 1] === "/") {
          i += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`, "i");
}
function matchesPattern(relPath, pattern) {
  const normalizedPath = normalizeRelPath(relPath);
  const normalizedPattern = normalizeRelPath(pattern);
  if (globToRegExp(normalizedPattern).test(normalizedPath)) return true;
  if (!normalizedPattern.includes("/")) {
    return normalizedPath.split("/").some((segment) => globToRegExp(normalizedPattern).test(segment));
  }
  return false;
}
function matchesAnyPattern(relPath, patterns) {
  const normalized = normalizeRelPath(relPath);
  return patterns.find((pattern) => matchesPattern(normalized, pattern));
}
function isTextFile(relPath) {
  const base = import_node_path.default.posix.basename(normalizeRelPath(relPath)).toLowerCase();
  const ext = import_node_path.default.posix.extname(base);
  return TEXT_EXTENSIONS.has(ext) || base === ".gitignore" || base === ".gitattributes" || base === ".env";
}
function isLfsFile(relPath, patterns) {
  return matchesAnyPattern(relPath, patterns.length ? patterns : DEFAULT_LFS_PATTERNS) !== void 0;
}
function pathHasWindowsIssue(relPath) {
  const normalized = normalizeRelPath(relPath);
  return normalized.split("/").some((segment) => {
    if (!segment || segment.endsWith(".") || segment.endsWith(" ")) return true;
    if (/[<>:"|?*]/.test(segment)) return true;
    const stem = segment.split(".")[0].toUpperCase();
    return WINDOWS_RESERVED.has(stem);
  });
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}
function formatDateTime(iso) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(date.getTime()) ? String(iso) : date.toLocaleString();
}
function redact(value, token = "") {
  let output = value;
  if (token) output = output.split(token).join("[REDACTED]");
  output = output.replace(/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "$1[REDACTED]");
  output = output.replace(/(Authorization:\s*token\s+)[^\s]+/gi, "$1[REDACTED]");
  return output;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function sha256File(filePath) {
  const hash = (0, import_node_crypto.createHash)("sha256");
  const handle = await import_node_fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = 0;
    do {
      const result = await handle.read(buffer, 0, buffer.length, null);
      bytesRead = result.bytesRead;
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}
async function readTextForSecretScan(filePath, maxBytes = 8 * 1024 * 1024, allowNul = false) {
  const stat = await import_node_fs.promises.stat(filePath);
  if (stat.size > maxBytes) return null;
  const buffer = await import_node_fs.promises.readFile(filePath);
  if (buffer.includes(0) && !allowNul) return null;
  return buffer.toString("utf8");
}
function isBundledCodeAsset(relPath) {
  const normalized = normalizeRelPath(relPath).toLowerCase();
  return /^\.obsidian\/plugins\/.+\/[^/]+\.(?:js|css|mjs|cjs)$/.test(normalized) || /^\.obsidian\/themes\/.+\/[^/]+\.css$/.test(normalized);
}
function looksSensitive(content, relPath) {
  const lowerPath = relPath.toLowerCase();
  if (lowerPath.endsWith(".pem") || lowerPath.endsWith(".key") || lowerPath.includes("/secrets/")) return true;
  if (PRIVATE_KEY_RE.test(content)) return true;
  if (isBundledCodeAsset(relPath)) {
    return LITERAL_TOKEN_RE.test(content) || LITERAL_SECRET_ASSIGNMENT_RE.test(content);
  }
  return SENSITIVE_KEY_RE.test(content) || TOKEN_VALUE_RE.test(content);
}
function isLikelySensitivePath(relPath) {
  const lower = relPath.toLowerCase();
  return lower.includes("secret") || lower.includes("credential") || lower.endsWith(".pem") || lower.endsWith(".key");
}
async function walkFiles(root, current = root, output = [], embeddedGitRoots = []) {
  const entries = await import_node_fs.promises.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = import_node_path.default.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.name === ".git") {
      if (current !== root) embeddedGitRoots.push(current);
      continue;
    }
    if (entry.isDirectory()) {
      await walkFiles(root, absolute, output, embeddedGitRoots);
    } else if (entry.isFile()) {
      output.push(absolute);
    }
  }
  return output;
}
async function scanVault(vaultPath, settings) {
  var _a;
  const files = [];
  const warnings = [];
  const errors = [];
  const allPatterns = [
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...settings.includeObsidian ? [] : [".obsidian/**"],
    ...settings.excludePatterns
  ];
  const embeddedGitRoots = [];
  const absoluteFiles = await walkFiles(vaultPath, vaultPath, [], embeddedGitRoots);
  const lowerPaths = /* @__PURE__ */ new Map();
  const windowsPathIssues = [];
  for (const absolutePath of absoluteFiles) {
    const relPath = normalizeRelPath(import_node_path.default.relative(vaultPath, absolutePath));
    if (!isSafeRelativePath(relPath)) {
      errors.push(`Unsafe path skipped: ${relPath}`);
      continue;
    }
    const stat = await import_node_fs.promises.stat(absolutePath);
    const isText = isTextFile(relPath);
    const exclusionReason = matchesAnyPattern(relPath, allPatterns);
    let sensitive2 = isLikelySensitivePath(relPath);
    if (!exclusionReason && isText && !sensitive2) {
      try {
        const bundledCode = isBundledCodeAsset(relPath);
        const content = await readTextForSecretScan(absolutePath, bundledCode ? 64 * 1024 * 1024 : 8 * 1024 * 1024, bundledCode);
        if (content === null) {
          errors.push(`Cannot inspect text file for secrets; exclude or inspect manually: ${relPath}`);
        } else {
          sensitive2 = looksSensitive(content, relPath);
        }
      } catch (error) {
        errors.push(`Cannot inspect ${relPath}: ${String(error)}`);
      }
    }
    const effectiveReason = exclusionReason != null ? exclusionReason : sensitive2 ? "Sensitive configuration detected" : void 0;
    const file = {
      path: relPath,
      absolutePath,
      size: stat.size,
      isText,
      isLfs: isLfsFile(relPath, settings.lfsPatterns),
      excluded: Boolean(effectiveReason),
      sensitive: sensitive2,
      exclusionReason: effectiveReason
    };
    files.push(file);
    const key = relPath.toLocaleLowerCase("en-US");
    const collision = (_a = lowerPaths.get(key)) != null ? _a : [];
    collision.push(relPath);
    lowerPaths.set(key, collision);
    if (pathHasWindowsIssue(relPath)) windowsPathIssues.push(relPath);
  }
  for (const directory of embeddedGitRoots) {
    const relPath = normalizeRelPath(import_node_path.default.relative(vaultPath, directory));
    if (!matchesAnyPattern(`${relPath}/.git`, allPatterns)) {
      errors.push(`Nested Git repository is not staged by the outer vault: ${relPath}. Exclude it or move its Git history outside the vault.`);
    }
  }
  const caseCollisions = [...lowerPaths.values()].filter((paths) => paths.length > 1);
  if (caseCollisions.length) warnings.push(`${caseCollisions.length} case-insensitive path collision(s) detected`);
  if (windowsPathIssues.length) warnings.push(`${windowsPathIssues.length} Windows-incompatible path(s) detected`);
  const included = files.filter((file) => !file.excluded);
  const excluded = files.filter((file) => file.excluded);
  const sensitive = files.filter((file) => file.sensitive);
  const lfsFiles = included.filter((file) => file.isLfs);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const includedBytes = included.reduce((sum, file) => sum + file.size, 0);
  const tooLarge = included.filter((file) => file.size > 100 * 1024 * 1024);
  if (tooLarge.length) warnings.push(`${tooLarge.length} file(s) exceed GitHub's ordinary Git file size limit; they must be tracked by Git LFS`);
  for (const file of tooLarge.filter((entry) => !entry.isLfs)) {
    errors.push(`File exceeds 100 MiB without an LFS rule: ${file.path}`);
  }
  if (includedBytes > 1024 * 1024 * 1024) warnings.push(`Included content is ${formatBytes(includedBytes)}; GitHub storage and LFS quota should be checked before the first upload`);
  return {
    files,
    included,
    excluded,
    sensitive,
    lfsFiles,
    totalBytes,
    includedBytes,
    warnings,
    errors,
    caseCollisions,
    windowsPathIssues
  };
}
function createSyncManifest(settings) {
  return {
    schemaVersion: 1,
    branch: settings.branch,
    includeObsidian: settings.includeObsidian,
    excludePatterns: [...settings.excludePatterns],
    lfsPatterns: [...settings.lfsPatterns],
    conflictFolder: settings.conflictFolder,
    generatedBy: "github-vault-sync"
  };
}
async function writeJsonFile(filePath, value) {
  await import_node_fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}
`, "utf8");
}
async function ensureDirectory(directory) {
  await import_node_fs.promises.mkdir(directory, { recursive: true });
}
async function removeIfExists(target) {
  await import_node_fs.promises.rm(target, { recursive: true, force: true });
}
function getManifestPath(vaultPath) {
  return import_node_path.default.join(vaultPath, SYNC_MANIFEST);
}

// src/encrypted-bundle.ts
var ENCRYPTED_BUNDLE = ".github-vault-sync-encrypted/vault.gvs";
var MAGIC = "GVS-AES-256-GCM-v1";
var AAD = Buffer.from("GitHub Vault Sync encrypted plugin backup v1");
var MAX_BYTES = 64 * 1024 * 1024;
var MAX_ENTRIES = 1e4;
var MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
async function readEnvelope(file) {
  if ((await import_node_fs2.promises.stat(file)).size > MAX_ARCHIVE_BYTES) throw new Error("Encrypted bundle exceeds safety limit");
  return JSON.parse(await import_node_fs2.promises.readFile(file, "utf8"));
}
function decodeKey(recoveryKey) {
  const normalized = recoveryKey.trim();
  if (!normalized.startsWith("GVS1-")) throw new Error("Invalid recovery key format");
  const raw = normalized.slice(5);
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new Error("Invalid recovery key length");
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== raw) throw new Error("Invalid recovery key");
  return key;
}
function generateRecoveryKey() {
  return `GVS1-${(0, import_node_crypto2.randomBytes)(32).toString("base64url")}`;
}
function validateRecoveryKey(key) {
  decodeKey(key);
  return key.trim();
}
function validFolder(name) {
  return /^[A-Za-z0-9._-]+$/.test(name) && name !== "." && name !== "..";
}
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    const source = value;
    return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonicalJson(source[key])]));
  }
  return value;
}
function allowedPayloadPath(rel, folders) {
  if (!isSafeRelativePath(rel) || normalizeRelPath(rel) !== rel || rel.includes("\0")) return false;
  const parts = rel.split("/");
  if (parts[0] !== ".obsidian" || parts[1] !== "plugins" || parts.length < 4 || !validFolder(parts[2])) return false;
  return parts.length === 4 && parts[3] === "data.json" || folders.includes(parts[2]);
}
async function collectFiles(vaultPath, settings) {
  var _a;
  const folders = (_a = settings.encryptedFolders) != null ? _a : [];
  if (!folders.every(validFolder)) throw new Error("Encrypted folder names must be simple plugin IDs");
  const plugins = import_node_path2.default.join(vaultPath, ".obsidian", "plugins");
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  let totalBytes = 0;
  async function addFile(absolute, sanitizeSelf = false) {
    const rel = normalizeRelPath(import_node_path2.default.relative(vaultPath, absolute));
    if (!allowedPayloadPath(rel, folders) || seen.has(rel)) return;
    const stat = await import_node_fs2.promises.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Cannot archive a non-regular plugin file: ${rel}`);
    if (stat.size > MAX_BYTES) throw new Error(`Encrypted plugin file is too large: ${rel}`);
    let bytes = await import_node_fs2.promises.readFile(absolute);
    if (rel.endsWith("/data.json")) {
      try {
        const config = JSON.parse(bytes.toString("utf8"));
        if (sanitizeSelf) {
          for (const key of [
            "encryptionKey",
            "encryptionLastDigest",
            "logEntries",
            "lastError",
            "lastStatus",
            "lastRemoteSha",
            "pendingMerge",
            "autoSyncEnabled",
            "autoSyncDelaySeconds",
            "startupCheck"
          ]) delete config[key];
        }
        bytes = Buffer.from(`${JSON.stringify(canonicalJson(config))}
`, "utf8");
      } catch (error) {
        if (sanitizeSelf) throw error;
      }
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_BYTES || entries.length >= MAX_ENTRIES) throw new Error("Encrypted plugin backup exceeds safety limits");
    seen.add(rel);
    entries.push({ path: rel, mode: stat.mode & 511, data: bytes.toString("base64") });
  }
  const installed = await import_node_fs2.promises.readdir(plugins, { withFileTypes: true });
  for (const plugin of installed) {
    if (!plugin.isDirectory() || !validFolder(plugin.name)) continue;
    const file = import_node_path2.default.join(plugins, plugin.name, "data.json");
    try {
      await import_node_fs2.promises.lstat(file);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    await addFile(file, plugin.name === "github-vault-sync");
  }
  async function walk(directory) {
    for (const file of await import_node_fs2.promises.readdir(directory, { withFileTypes: true })) {
      const absolute = import_node_path2.default.join(directory, file.name);
      if (file.isSymbolicLink()) throw new Error(`Symlink inside encrypted plugin folder: ${normalizeRelPath(import_node_path2.default.relative(vaultPath, absolute))}`);
      if (file.isDirectory()) await walk(absolute);
      else if (file.isFile()) await addFile(absolute);
    }
  }
  for (const folder of folders) {
    const dir = import_node_path2.default.join(plugins, folder);
    try {
      await import_node_fs2.promises.access(dir);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    await walk(dir);
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return entries;
}
function encryptPayload(payload, recoveryKey) {
  const key = decodeKey(recoveryKey);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  if (plain.length > MAX_ARCHIVE_BYTES) throw new Error("Encrypted archive is too large");
  const digest = (0, import_node_crypto2.createHmac)("sha256", key).update(plain).digest("hex");
  const nonce = (0, import_node_crypto2.randomBytes)(12);
  const cipher = (0, import_node_crypto2.createCipheriv)("aes-256-gcm", key, nonce);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update((0, import_node_zlib.gzipSync)(plain)), cipher.final()]);
  return {
    format: MAGIC,
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    digest,
    entries: payload.entries.length
  };
}
function decryptPayload(envelope, recoveryKey) {
  if (envelope.format !== MAGIC || !Number.isSafeInteger(envelope.entries) || envelope.entries < 0 || envelope.entries > MAX_ENTRIES) {
    throw new Error("Unsupported encrypted bundle format");
  }
  const key = decodeKey(recoveryKey);
  const nonce = Buffer.from(envelope.nonce, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_ARCHIVE_BYTES) throw new Error("Invalid encrypted bundle");
  const decipher = (0, import_node_crypto2.createDecipheriv)("aes-256-gcm", key, nonce);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  const zipped = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const plain = (0, import_node_zlib.gunzipSync)(zipped, { maxOutputLength: MAX_ARCHIVE_BYTES });
  const expected = (0, import_node_crypto2.createHmac)("sha256", key).update(plain).digest();
  const actual = Buffer.from(envelope.digest, "hex");
  if (actual.length !== expected.length || !(0, import_node_crypto2.timingSafeEqual)(actual, expected)) throw new Error("Encrypted bundle checksum mismatch");
  const parsed = JSON.parse(plain.toString("utf8"));
  if (parsed.version !== 1 || !Array.isArray(parsed.entries) || parsed.entries.length !== envelope.entries) {
    throw new Error("Invalid encrypted bundle payload");
  }
  return parsed;
}
async function writeRecoveryKeyFile(settings, recoveryDirectory) {
  if (!settings.repo) throw new Error("Bind a repository before exporting a recovery key");
  const key = validateRecoveryKey(settings.encryptionKey);
  const root = recoveryDirectory != null ? recoveryDirectory : import_node_path2.default.join(import_node_os.default.homedir(), "Library", "Application Support", "github-vault-sync-backups", "recovery-keys");
  await ensureDirectory(root);
  await import_node_fs2.promises.chmod(root, 448);
  const owner = settings.repo.owner.replace(/[^A-Za-z0-9._-]/g, "-");
  const name = settings.repo.name.replace(/[^A-Za-z0-9._-]/g, "-");
  const destination = import_node_path2.default.join(root, `${owner}-${name}.key`);
  try {
    await import_node_fs2.promises.writeFile(destination, `${key}
`, { encoding: "utf8", mode: 384, flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    if ((await import_node_fs2.promises.readFile(destination, "utf8")).trim() !== key) {
      throw new Error("A different recovery key already exists; refusing to overwrite it");
    }
  }
  await import_node_fs2.promises.chmod(destination, 384);
  return destination;
}
async function prepareEncryptedBundle(vaultPath, settings) {
  if (!settings.encryptedSyncEnabled) return { changed: false, entries: 0, needsRestore: false };
  if (!settings.encryptionKey) throw new Error("Encrypted synchronization requires a local recovery key");
  const payload = { version: 1, entries: await collectFiles(vaultPath, settings) };
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const digest = (0, import_node_crypto2.createHmac)("sha256", decodeKey(settings.encryptionKey)).update(plain).digest("hex");
  const target = import_node_path2.default.join(vaultPath, ENCRYPTED_BUNDLE);
  try {
    const old = await readEnvelope(target);
    if (old.format !== MAGIC) throw new Error("Unrecognized encrypted bundle on disk");
    if (old.digest === digest) {
      settings.encryptionLastDigest = digest;
      return { changed: false, entries: payload.entries.length, needsRestore: false };
    }
    if (!settings.encryptionLastDigest) {
      return { changed: false, entries: payload.entries.length, needsRestore: true };
    }
    if (old.digest !== settings.encryptionLastDigest) {
      if (digest === settings.encryptionLastDigest) {
        return { changed: false, entries: payload.entries.length, needsRestore: true };
      }
      throw new Error("Local and remote encrypted settings both changed; resolve the encrypted archive conflict manually");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const envelope = encryptPayload(payload, settings.encryptionKey);
  await ensureDirectory(import_node_path2.default.dirname(target));
  const temporary = `${target}.tmp-${process.pid}`;
  try {
    await import_node_fs2.promises.writeFile(temporary, `${JSON.stringify(envelope)}
`, { encoding: "utf8", mode: 384 });
    await import_node_fs2.promises.rename(temporary, target);
  } finally {
    await import_node_fs2.promises.rm(temporary, { force: true });
  }
  settings.encryptionLastDigest = digest;
  return { changed: true, entries: payload.entries.length, needsRestore: false };
}
async function inspectEncryptedBundle(vaultPath, settings) {
  var _a;
  const envelope = await readEnvelope(import_node_path2.default.join(vaultPath, ENCRYPTED_BUNDLE));
  const payload = decryptPayload(envelope, settings.encryptionKey);
  const folders = (_a = settings.encryptedFolders) != null ? _a : [];
  const paths = /* @__PURE__ */ new Set();
  let totalBytes = 0;
  for (const entry of payload.entries) {
    if (!allowedPayloadPath(entry.path, folders) || paths.has(entry.path)) throw new Error("Unsafe or duplicate path in encrypted bundle");
    paths.add(entry.path);
    const data = Buffer.from(entry.data, "base64");
    totalBytes += data.length;
    if (data.length > MAX_BYTES || totalBytes > MAX_BYTES) throw new Error("Encrypted bundle is too large to restore");
  }
  return { files: paths.size, totalBytes };
}
async function restoreEncryptedBundle(vaultPath, settings, restoreSelf = false, backupRoot) {
  var _a, _b, _c;
  const envelope = await readEnvelope(import_node_path2.default.join(vaultPath, ENCRYPTED_BUNDLE));
  const payload = decryptPayload(envelope, settings.encryptionKey);
  const folders = (_a = settings.encryptedFolders) != null ? _a : [];
  const seen = /* @__PURE__ */ new Set();
  const safe = [];
  let totalBytes = 0;
  for (const entry of payload.entries) {
    if (!allowedPayloadPath(entry.path, folders) || seen.has(entry.path) || !Number.isInteger(entry.mode)) {
      throw new Error("Unsafe or duplicate path in encrypted bundle");
    }
    seen.add(entry.path);
    if (!restoreSelf && entry.path === ".obsidian/plugins/github-vault-sync/data.json") continue;
    let data = Buffer.from(entry.data, "base64");
    if (entry.path === ".obsidian/plugins/github-vault-sync/data.json") {
      const own = JSON.parse(data.toString("utf8"));
      const archivedRepo = own.repo;
      if ((archivedRepo == null ? void 0 : archivedRepo.owner) !== ((_b = settings.repo) == null ? void 0 : _b.owner) || (archivedRepo == null ? void 0 : archivedRepo.name) !== ((_c = settings.repo) == null ? void 0 : _c.name)) {
        throw new Error("Archived plugin credentials belong to another repository");
      }
      own.encryptionKey = settings.encryptionKey;
      own.encryptedSyncEnabled = true;
      own.encryptedFolders = folders;
      own.encryptionLastDigest = envelope.digest;
      own.lastStatus = settings.lastStatus;
      own.lastRemoteSha = settings.lastRemoteSha;
      own.pendingMerge = settings.pendingMerge;
      data = Buffer.from(`${JSON.stringify(own, null, 2)}
`);
    }
    totalBytes += data.length;
    if (data.length > MAX_BYTES || totalBytes > MAX_BYTES) throw new Error("Encrypted bundle is too large to restore");
    safe.push({ path: entry.path, data, mode: entry.mode & 511 });
  }
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const backup = import_node_path2.default.join(backupRoot != null ? backupRoot : import_node_path2.default.join(import_node_os.default.homedir(), "Library", "Application Support", "github-vault-sync-backups", "restores"), stamp);
  await ensureDirectory(backup);
  await import_node_fs2.promises.chmod(backup, 448);
  for (const entry of safe) {
    const target = import_node_path2.default.join(vaultPath, entry.path);
    const destination = import_node_path2.default.join(backup, entry.path);
    let segment = vaultPath;
    for (const part of entry.path.split("/")) {
      segment = import_node_path2.default.join(segment, part);
      try {
        if ((await import_node_fs2.promises.lstat(segment)).isSymbolicLink()) throw new Error(`Refusing symlink restore path: ${entry.path}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    try {
      const old = await import_node_fs2.promises.lstat(target);
      if (!old.isFile()) throw new Error(`Cannot overwrite a non-file during restore: ${entry.path}`);
      await ensureDirectory(import_node_path2.default.dirname(destination));
      await import_node_fs2.promises.copyFile(target, destination);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const entry of safe) {
    const target = import_node_path2.default.join(vaultPath, entry.path);
    await ensureDirectory(import_node_path2.default.dirname(target));
    const temporary = `${target}.restore-${process.pid}`;
    try {
      await import_node_fs2.promises.writeFile(temporary, entry.data, { mode: entry.path.endsWith("/data.json") ? 384 : entry.mode });
      await import_node_fs2.promises.rename(temporary, target);
    } finally {
      await import_node_fs2.promises.rm(temporary, { force: true });
    }
  }
  settings.encryptionLastDigest = envelope.digest;
  return { restored: safe.length, backup };
}

// src/github.ts
var import_obsidian = require("obsidian");
var API_ROOT = "https://api.github.com";
var WEB_ROOT = "https://github.com";
var GithubApiError = class extends Error {
  constructor(message, status, responseBody = "") {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
};
var GithubClient = class {
  constructor(settings) {
    this.settings = settings;
  }
  get token() {
    if (!this.settings.token) throw new Error("GitHub is not authenticated");
    return this.settings.token;
  }
  async request(pathOrUrl, options = {}) {
    var _a, _b;
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_ROOT}${pathOrUrl}`;
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "GitHub-Vault-Sync/0.1.0"
    };
    if (options.auth !== false) headers.Authorization = `Bearer ${this.token}`;
    let body;
    if (options.body !== void 0) {
      body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }
    const response = await (0, import_obsidian.requestUrl)({
      url,
      method: (_a = options.method) != null ? _a : "GET",
      headers,
      body,
      throw: false
    });
    const text = (_b = response.text) != null ? _b : "";
    let parsed = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (e) {
      }
    }
    if (response.status >= 400) {
      const message = typeof parsed === "object" && parsed !== null && "message" in parsed ? String(parsed.message) : `GitHub request failed with HTTP ${response.status}`;
      throw new GithubApiError(message, response.status, text);
    }
    return parsed;
  }
  async getAuthenticatedUser() {
    return this.request("/user");
  }
  async startDeviceFlow(clientId) {
    var _a, _b;
    if (!clientId.trim()) throw new Error("OAuth client ID is not configured");
    const response = await (0, import_obsidian.requestUrl)({
      url: `${WEB_ROOT}/login/device/code`,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "GitHub-Vault-Sync/0.1.0"
      },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        scope: "repo read:user offline_access"
      }).toString(),
      throw: false
    });
    const data = JSON.parse(response.text || "{}");
    if (response.status >= 400 || data.error) {
      throw new GithubApiError((_b = (_a = data.error_description) != null ? _a : data.error) != null ? _b : "Unable to start GitHub device authorization", response.status, response.text);
    }
    return data;
  }
  async pollDeviceFlow(clientId, deviceCode, onWaiting) {
    var _a, _b;
    const deadline = Date.now() + deviceCode.expires_in * 1e3;
    let interval = Math.max(deviceCode.interval || 5, 5);
    while (Date.now() < deadline) {
      await sleep(interval * 1e3);
      const response = await (0, import_obsidian.requestUrl)({
        url: `${WEB_ROOT}/login/oauth/access_token`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GitHub-Vault-Sync/0.1.0"
        },
        body: new URLSearchParams({ client_id: clientId.trim(), device_code: deviceCode.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }).toString(),
        throw: false
      });
      const data = JSON.parse(response.text || "{}");
      if (data.access_token) return data.access_token;
      if (data.error === "authorization_pending") {
        onWaiting == null ? void 0 : onWaiting(interval);
        continue;
      }
      if (data.error === "slow_down") {
        interval += 5;
        onWaiting == null ? void 0 : onWaiting(interval);
        continue;
      }
      if (data.error === "expired_token") throw new Error("GitHub device code expired");
      if (data.error === "access_denied") throw new Error("GitHub authorization was denied");
      throw new GithubApiError((_b = (_a = data.error_description) != null ? _a : data.error) != null ? _b : "GitHub authorization failed", response.status, response.text);
    }
    throw new Error("GitHub device authorization timed out");
  }
  async validateToken(token) {
    const previous = this.settings.token;
    this.settings.token = token.trim();
    try {
      return await this.getAuthenticatedUser();
    } finally {
      this.settings.token = previous;
    }
  }
  async getRepository(owner, name) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  }
  async createPrivateRepository(name, description) {
    return this.request("/user/repos", {
      method: "POST",
      body: {
        name: name.trim(),
        description: (description == null ? void 0 : description.trim()) || "Obsidian vault synchronized by GitHub Vault Sync",
        private: true,
        auto_init: false
      }
    });
  }
  async bindRepository(owner, name) {
    var _a, _b;
    const repo = await this.getRepository(owner, name);
    if (!repo.private) throw new Error("The selected repository must be private");
    if (repo.permissions && repo.permissions.pull === false) throw new Error("The GitHub token cannot read this repository");
    if (repo.permissions && repo.permissions.push === false) throw new Error("The GitHub token cannot write to this repository");
    return {
      owner: (_b = (_a = repo.owner) == null ? void 0 : _a.login) != null ? _b : owner,
      name: repo.name,
      branch: repo.default_branch || "main",
      remoteUrl: repo.clone_url,
      private: repo.private
    };
  }
};

// src/sync-engine.ts
var import_node_fs5 = require("node:fs");
var import_node_crypto3 = require("node:crypto");
var import_node_path6 = __toESM(require("node:path"));

// src/git.ts
var import_node_child_process = require("node:child_process");
var import_node_fs3 = require("node:fs");
var import_node_os2 = __toESM(require("node:os"));
var import_node_path3 = __toESM(require("node:path"));
var GitCommandError = class extends Error {
  constructor(message, args, code, stdout, stderr) {
    super(message);
    this.name = "GitCommandError";
    this.args = args;
    this.code = code;
    this.stdout = stdout.toString("utf8");
    this.stderr = stderr.toString("utf8");
  }
};
function parseGitTransferProgress(text) {
  const regex = /(Uploading LFS objects|Writing objects):\s*(\d+)%\s*\((\d+)\/(\d+)\)/g;
  let match;
  let latest = null;
  while ((match = regex.exec(text)) !== null) {
    const completed = Number(match[3]);
    const total = Number(match[4]);
    if (total <= 0 || completed > total) continue;
    latest = {
      kind: match[1] === "Uploading LFS objects" ? "lfs" : "git",
      completed,
      total,
      percent: Math.min(100, Math.max(0, Number(match[2])))
    };
  }
  return latest;
}
var GitService = class {
  constructor(vaultPath, settings) {
    this.vaultPath = vaultPath;
    this.settings = settings;
    this.gitExecutable = "git";
    this.gitLfsAvailable = false;
    this.initialized = false;
  }
  get authToken() {
    return this.settings.token;
  }
  async resolveExecutable() {
    const candidates = process.platform === "win32" ? [
      "git",
      "C:\\Program Files\\Git\\cmd\\git.exe",
      "C:\\Program Files\\Git\\bin\\git.exe",
      "C:\\Program Files (x86)\\Git\\cmd\\git.exe"
    ] : ["git", "/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
    for (const candidate of candidates) {
      try {
        const result = await this.runRaw(candidate, ["--version"], { timeoutMs: 15e3, allowFailure: true });
        if (result.code === 0) return candidate;
      } catch (e) {
      }
    }
    throw new Error("Git executable was not found. Install Git and retry.");
  }
  async runRaw(command, args, options = {}) {
    var _a;
    const timeoutMs = (_a = options.timeoutMs) != null ? _a : 30 * 60 * 1e3;
    const authDir = await import_node_fs3.promises.mkdtemp(import_node_path3.default.join(import_node_os2.default.tmpdir(), "github-vault-sync-askpass-"));
    let askpassPath;
    try {
      const env = {
        ...process.env,
        // Electron apps launched from Finder often omit Homebrew from PATH.
        // Git discovers the installed git-lfs subcommand through this value.
        PATH: process.platform === "win32" ? process.env.PATH : [process.env.PATH, "/opt/homebrew/bin", "/usr/local/bin"].filter(Boolean).join(import_node_path3.default.delimiter),
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0"
      };
      if (this.authToken) {
        if (process.platform === "win32") {
          askpassPath = import_node_path3.default.join(authDir, "askpass.cmd");
          await import_node_fs3.promises.writeFile(
            askpassPath,
            '@echo off\r\necho %~1 | findstr /I "username" >nul\r\nif %errorlevel%==0 (echo %GITHUB_VAULT_SYNC_USERNAME%) else (echo %GITHUB_VAULT_SYNC_TOKEN%)\r\n',
            "utf8"
          );
        } else {
          askpassPath = import_node_path3.default.join(authDir, "askpass.sh");
          await import_node_fs3.promises.writeFile(
            askpassPath,
            [
              "#!/bin/sh",
              'case "$1" in',
              '  *[Uu]sername*) printf "%s" "$GITHUB_VAULT_SYNC_USERNAME" ;;',
              '  *) printf "%s" "$GITHUB_VAULT_SYNC_TOKEN" ;;',
              "esac",
              ""
            ].join("\n"),
            { encoding: "utf8", mode: 448 }
          );
        }
        env.GIT_ASKPASS = askpassPath;
        env.GITHUB_VAULT_SYNC_TOKEN = this.authToken;
        env.GITHUB_VAULT_SYNC_USERNAME = "oauth2";
      }
      return await new Promise((resolve, reject) => {
        var _a2;
        const child = (0, import_node_child_process.spawn)(command, args, {
          cwd: (_a2 = options.cwd) != null ? _a2 : this.vaultPath,
          env,
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
        const stdout = [];
        const stderr = [];
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          child.kill(process.platform === "win32" ? void 0 : "SIGTERM");
          const timeoutError = new Error(`Git command timed out after ${Math.round(timeoutMs / 1e3)}s: ${args.join(" ")}`);
          settled = true;
          reject(timeoutError);
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
          var _a3;
          stdout.push(chunk);
          (_a3 = options.onOutput) == null ? void 0 : _a3.call(options, chunk.toString("utf8"));
        });
        child.stderr.on("data", (chunk) => {
          var _a3;
          stderr.push(chunk);
          (_a3 = options.onOutput) == null ? void 0 : _a3.call(options, chunk.toString("utf8"));
        });
        child.on("error", (error) => {
          if (settled) return;
          clearTimeout(timer);
          settled = true;
          reject(error);
        });
        child.on("close", (code) => {
          if (settled) return;
          clearTimeout(timer);
          settled = true;
          resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), code: code != null ? code : 1 });
        });
      });
    } finally {
      await removeIfExists(authDir);
    }
  }
  async run(args, options = {}) {
    if (!this.initialized) {
      this.gitExecutable = await this.resolveExecutable();
      this.initialized = true;
    }
    const result = await this.runRaw(this.gitExecutable, args, options);
    if (result.code !== 0 && !options.allowFailure) {
      const safeArgs = args.map((arg) => this.authToken && arg.includes(this.authToken) ? "[REDACTED]" : arg);
      throw new GitCommandError(
        `Git command failed (${result.code}): ${safeArgs.join(" ")}
${redact(result.stderr.toString("utf8"), this.authToken)}`,
        args,
        result.code,
        result.stdout,
        result.stderr
      );
    }
    return result;
  }
  async text(args, options = {}) {
    const result = await this.run(args, options);
    return result.stdout.toString("utf8");
  }
  async tryText(args, options = {}) {
    const result = await this.run(args, { ...options, allowFailure: true });
    return result.code === 0 ? result.stdout.toString("utf8") : null;
  }
  async dependencies() {
    let gitVersion = "";
    let gitError;
    let gitAvailable = false;
    try {
      this.gitExecutable = await this.resolveExecutable();
      this.initialized = true;
      gitVersion = (await this.text(["--version"], { timeoutMs: 15e3 })).trim();
      gitAvailable = true;
    } catch (error) {
      gitError = String(error);
    }
    let lfsVersion = "";
    let lfsError;
    let lfsAvailable = false;
    let initialized = false;
    if (gitAvailable) {
      try {
        const result = await this.run(["lfs", "version"], { timeoutMs: 15e3, allowFailure: true });
        lfsAvailable = result.code === 0;
        lfsVersion = result.stdout.toString("utf8").trim() || result.stderr.toString("utf8").trim();
        if (lfsAvailable) {
          const env = await this.run(["lfs", "env"], { timeoutMs: 15e3, allowFailure: true });
          initialized = env.code === 0 && /LocalWorkingDir|LocalMediaDir/i.test(env.stdout.toString("utf8"));
        }
      } catch (error) {
        lfsError = String(error);
      }
    }
    this.gitLfsAvailable = lfsAvailable;
    return {
      git: { available: gitAvailable, version: gitVersion, executable: this.gitExecutable, error: gitError },
      gitLfs: { available: lfsAvailable, version: lfsVersion, initialized, error: lfsError }
    };
  }
  async init(branch = "main") {
    var _a, _b;
    const gitDir = import_node_path3.default.join(this.vaultPath, ".git");
    try {
      const stat = await import_node_fs3.promises.stat(gitDir);
      if (!stat.isDirectory()) throw new Error(`${gitDir} exists but is not a directory`);
    } catch (e) {
      await this.run(["init", "-b", branch]);
    }
    const current = (_b = (_a = await this.tryText(["branch", "--show-current"])) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (!current) {
      await this.run(["checkout", "-B", branch]);
    } else if (current !== branch) {
      const branchExists = (await this.run(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], { allowFailure: true })).code === 0;
      if (branchExists) await this.run(["checkout", branch]);
      else await this.run(["checkout", "-B", branch]);
    }
    await this.run(["config", "user.name", this.settings.gitUserName || "GitHub Vault Sync"]);
    await this.run(["config", "user.email", this.settings.gitUserEmail || "github-vault-sync@users.noreply.github.com"]);
  }
  async ensureLfsInitialized() {
    if (!this.gitLfsAvailable) throw new Error("Git LFS is not available");
    await this.run(["lfs", "install", "--local"]);
  }
  async setRemote(binding) {
    const existing = await this.tryText(["remote", "get-url", "origin"]);
    if (existing == null ? void 0 : existing.trim()) {
      if (existing.trim() !== binding.remoteUrl) await this.run(["remote", "set-url", "origin", binding.remoteUrl]);
    } else {
      await this.run(["remote", "add", "origin", binding.remoteUrl]);
    }
  }
  async getRemoteUrl() {
    var _a;
    return ((_a = await this.tryText(["remote", "get-url", "origin"])) == null ? void 0 : _a.trim()) || null;
  }
  async hasHead() {
    const result = await this.run(["rev-parse", "--verify", "HEAD"], { allowFailure: true });
    return result.code === 0;
  }
  async headSha() {
    var _a;
    return ((_a = await this.tryText(["rev-parse", "HEAD"])) == null ? void 0 : _a.trim()) || null;
  }
  async refSha(ref) {
    var _a;
    return ((_a = await this.tryText(["rev-parse", ref])) == null ? void 0 : _a.trim()) || null;
  }
  async mergeBase(left, right) {
    var _a;
    return ((_a = await this.tryText(["merge-base", left, right])) == null ? void 0 : _a.trim()) || null;
  }
  async branchAheadBehind(local = "HEAD", remote = "origin/main") {
    const output = await this.tryText(["rev-list", "--left-right", "--count", `${local}...${remote}`]);
    if (!output) return { ahead: 0, behind: 0 };
    const [ahead, behind] = output.trim().split(/\s+/).map((value) => Number.parseInt(value, 10));
    return { ahead: Number.isFinite(ahead) ? ahead : 0, behind: Number.isFinite(behind) ? behind : 0 };
  }
  async remoteBranchExists(branch) {
    const output = await this.tryText(["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
    return Boolean(output == null ? void 0 : output.trim());
  }
  async fetch(branch) {
    await this.run(["fetch", "--prune", "origin", branch], { onOutput: () => void 0 });
  }
  async status() {
    var _a, _b, _c;
    const result = await this.run(["status", "--porcelain=v1", "-z", "-uall"]);
    const tokens = result.stdout.toString("utf8").split("\0").filter(Boolean);
    const output = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const index = (_a = token[0]) != null ? _a : " ";
      const worktree = (_b = token[1]) != null ? _b : " ";
      const pathValue = normalizeRelPath(token.slice(3));
      const entry = { index, worktree, path: pathValue };
      if (index === "R" || worktree === "R" || index === "C" || worktree === "C") {
        entry.oldPath = normalizeRelPath((_c = tokens[i + 1]) != null ? _c : "");
        i += 1;
      }
      output.push(entry);
    }
    return output;
  }
  async hasWorkingChanges() {
    return (await this.status()).length > 0;
  }
  async changedEntries(base, head) {
    var _a, _b, _c;
    const result = await this.run(["diff", "--name-status", "-z", base, head]);
    const tokens = result.stdout.toString("utf8").split("\0").filter(Boolean);
    const entries = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const status = tokens[i];
      if (status.startsWith("R") || status.startsWith("C")) {
        const oldPath = normalizeRelPath((_a = tokens[i + 1]) != null ? _a : "");
        const newPath = normalizeRelPath((_b = tokens[i + 2]) != null ? _b : "");
        entries.push({ status: status[0], oldPath, path: newPath });
        i += 2;
      } else {
        entries.push({ status: status[0], path: normalizeRelPath((_c = tokens[i + 1]) != null ? _c : "") });
        i += 1;
      }
    }
    return entries;
  }
  async treePaths(ref) {
    const result = await this.run(["ls-tree", "-r", "--name-only", "-z", ref]);
    return new Set(result.stdout.toString("utf8").split("\0").filter(Boolean).map(normalizeRelPath));
  }
  async showFile(ref, relPath) {
    return (await this.run(["show", `${ref}:${relPath}`])).stdout;
  }
  async pathExistsInRef(ref, relPath) {
    const result = await this.run(["cat-file", "-e", `${ref}:${relPath}`], { allowFailure: true });
    return result.code === 0;
  }
  async fileSizeAndHash(ref, relPath) {
    const content = await this.run(["show", `${ref}:${relPath}`], { allowFailure: true });
    if (content.code !== 0) return null;
    const { createHash: createHash3 } = await import("node:crypto");
    return { size: content.stdout.length, hash: createHash3("sha256").update(content.stdout).digest("hex") };
  }
  async checkoutPath(ref, relPath) {
    await this.run(["checkout", ref, "--", relPath]);
  }
  async removeWorkingPath(relPath) {
    const tracked = await this.run(["ls-files", "--error-unmatch", "--", relPath], { allowFailure: true });
    if (tracked.code === 0) {
      await this.run(["rm", "-f", "--", relPath]);
    } else {
      await import_node_fs3.promises.rm(import_node_path3.default.join(this.vaultPath, relPath), { force: true, recursive: true });
    }
  }
  async addAll(onProgress) {
    const scan = await scanVault(this.vaultPath, this.settings);
    if (scan.errors.length || scan.caseCollisions.length || scan.windowsPathIssues.length) {
      throw new Error(`Vault preflight failed before staging: ${[
        ...scan.errors,
        ...scan.caseCollisions.map((paths2) => paths2.join(" / ")),
        ...scan.windowsPathIssues
      ].slice(0, 20).join("; ")}`);
    }
    const included = new Set(scan.included.map((file) => file.path));
    const excluded = new Set(scan.excluded.map((file) => file.path));
    const rules = [
      ...DEFAULT_EXCLUDE_PATTERNS,
      ...this.settings.includeObsidian ? [] : [".obsidian/**"],
      ...this.settings.excludePatterns
    ];
    const tracked = (await this.run(["ls-files", "--cached", "-z"])).stdout.toString("utf8").split("\0").filter(Boolean);
    const paths = new Set(included);
    for (const relPath of tracked) {
      if (!isSafeRelativePath(relPath) || excluded.has(relPath) || matchesAnyPattern(relPath, rules) || isLikelySensitivePath(relPath)) {
        throw new Error(`Tracked file is excluded or sensitive; refusing to commit: ${relPath}. Review the repository history and untrack this path before syncing.`);
      }
      if (!included.has(relPath)) {
        try {
          await import_node_fs3.promises.lstat(import_node_path3.default.join(this.vaultPath, relPath));
          throw new Error(`Tracked path is not a regular vault file: ${relPath}`);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        paths.add(relPath);
      }
    }
    const selected = [...paths];
    for (let index = 0; index < selected.length; index += 100) {
      const batch = selected.slice(index, index + 100);
      await this.run(["add", "--all", "--", ...batch.map((entry) => `:(literal)${entry}`)]);
      onProgress == null ? void 0 : onProgress(Math.min(index + batch.length, selected.length), selected.length);
    }
    const staged = new Set((await this.run(["ls-files", "--cached", "-z"])).stdout.toString("utf8").split("\0").filter(Boolean));
    const missing = scan.included.filter((file) => !staged.has(file.path));
    if (missing.length) throw new Error(`Git could not stage ${missing.length} selected file(s), possibly in an embedded repository: ${missing.slice(0, 5).join(", ")}`);
  }
  async hasStagedChanges() {
    const result = await this.run(["diff", "--cached", "--quiet"], { allowFailure: true });
    return result.code !== 0;
  }
  async commit(message, allowEmpty = false) {
    const args = ["commit", "-m", message];
    if (allowEmpty) args.push("--allow-empty");
    await this.run(args);
  }
  async commitWorkingTree(message, onProgress) {
    await this.addAll(onProgress);
    if (!await this.hasStagedChanges()) return false;
    await this.commit(message);
    return true;
  }
  async push(branch, onProgress) {
    let recent = "";
    let last = "";
    await this.run(["push", "--set-upstream", "origin", branch], {
      timeoutMs: 3 * 60 * 60 * 1e3,
      onOutput: (chunk) => {
        recent = (recent + chunk.replace(/\x1b\[[0-9;]*m/g, "")).slice(-4096);
        const progress = parseGitTransferProgress(recent);
        if (!progress) return;
        const key = `${progress.kind}:${progress.completed}/${progress.total}`;
        if (key !== last) {
          last = key;
          onProgress == null ? void 0 : onProgress(progress);
        }
      }
    });
  }
  async fastForward(remoteRef) {
    await this.run(["merge", "--ff-only", remoteRef]);
  }
  async beginOursMerge(remoteRef, allowUnrelatedHistories) {
    const args = ["merge", "--no-commit", "--no-ff", "-s", "ours"];
    if (allowUnrelatedHistories) args.push("--allow-unrelated-histories");
    args.push(remoteRef);
    await this.run(args);
  }
  async commitMerge(message) {
    await this.addAll();
    await this.commit(message);
  }
  async abortMerge() {
    const result = await this.run(["merge", "--abort"], { allowFailure: true });
    if (result.code !== 0) {
      await this.run(["reset", "--merge"], { allowFailure: true });
    }
  }
  async isMergeInProgress() {
    const gitDir = await this.gitDirAbsolute();
    try {
      await import_node_fs3.promises.access(import_node_path3.default.join(gitDir, "MERGE_HEAD"));
      return true;
    } catch (e) {
      return false;
    }
  }
  async gitDirAbsolute() {
    const gitDir = (await this.text(["rev-parse", "--git-dir"])).trim();
    return import_node_path3.default.isAbsolute(gitDir) ? gitDir : import_node_path3.default.resolve(this.vaultPath, gitDir);
  }
  async writeLocalExclude(entries, previousPatterns = []) {
    const gitDir = await this.gitDirAbsolute();
    const infoDir = import_node_path3.default.join(gitDir, "info");
    await ensureDirectory(infoDir);
    const excludePath = import_node_path3.default.join(infoDir, "exclude");
    let existing = "";
    try {
      existing = await import_node_fs3.promises.readFile(excludePath, "utf8");
    } catch (e) {
    }
    const begin = "# BEGIN GITHUB VAULT SYNC EXCLUDES";
    const end = "# END GITHUB VAULT SYNC EXCLUDES";
    const lines = existing.split(/\r?\n/).filter(Boolean);
    const start = lines.indexOf(begin);
    const finish = start < 0 ? -1 : lines.indexOf(end, start + 1);
    let preserved;
    if (finish >= 0) {
      preserved = [...lines.slice(0, start), ...lines.slice(finish + 1)];
    } else {
      const generated = /* @__PURE__ */ new Set([
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...previousPatterns,
        ...entries,
        ".git/",
        ".trash/",
        ".obsidian/",
        ".obsidian/cache/",
        ".obsidian/workspace*.json",
        ".github-vault-sync-conflicts/",
        ".obsidian/plugins/**",
        ".obsidian/themes/**",
        "**/.DS_Store"
      ]);
      preserved = lines.filter((line) => !generated.has(line));
    }
    const managed = [...new Set(entries)];
    await import_node_fs3.promises.writeFile(excludePath, `${[...preserved, begin, ...managed, end].join("\n")}
`, "utf8");
  }
  async cleanIncludedFiles(paths) {
    for (const relPath of paths) {
      if (!relPath || relPath === ".git") continue;
      await import_node_fs3.promises.rm(import_node_path3.default.join(this.vaultPath, relPath), { recursive: true, force: true });
    }
  }
  async currentBranch() {
    var _a;
    return ((_a = await this.tryText(["branch", "--show-current"])) == null ? void 0 : _a.trim()) || null;
  }
};

// src/difference.ts
function changedPaths(entries) {
  const paths = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (entry.path) paths.add(entry.path);
    if (entry.oldPath) paths.add(entry.oldPath);
  }
  return paths;
}
function summarizeDifference(localFiles, remoteFiles, localChanges, remoteChanges, checkedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const local = new Set(localFiles);
  const remote = new Set(remoteFiles);
  const left = new Set(localChanges);
  const right = new Set(remoteChanges);
  const allPaths = /* @__PURE__ */ new Set([...local, ...remote]);
  const different = /* @__PURE__ */ new Set([...left, ...right]);
  for (const item of allPaths) if (local.has(item) !== remote.has(item)) different.add(item);
  return {
    localChanged: left.size,
    remoteChanged: right.size,
    differingPaths: different.size,
    totalPaths: allPaths.size,
    differencePercent: allPaths.size ? Math.min(100, Math.round(different.size / allPaths.size * 1e4) / 100) : 0,
    checkedAt
  };
}

// src/sync-preview.ts
var import_node_path4 = __toESM(require("node:path"));
function isMarkdownNote(relPath) {
  return !relPath.startsWith(".obsidian/") && /\.(?:md|markdown)$/i.test(relPath);
}
function categorizeChanges(changes, knownNotePaths) {
  const folders = /* @__PURE__ */ new Set();
  for (const note of knownNotePaths) {
    if (!isMarkdownNote(note)) continue;
    const folder = import_node_path4.default.posix.dirname(note);
    if (folder !== ".") folders.add(folder);
  }
  for (const change of changes) {
    if (!isMarkdownNote(change.path)) continue;
    const folder = import_node_path4.default.posix.dirname(change.path);
    if (folder !== ".") folders.add(folder);
  }
  const result = {
    notes: [],
    noteAttachments: [],
    obsidianConfig: [],
    otherFiles: []
  };
  for (const change of changes) {
    const file = change.path;
    if (isMarkdownNote(file)) result.notes.push(change);
    else if (file.startsWith(".obsidian/") || file.startsWith(".github-vault-sync-encrypted/") || file === ".github-vault-sync.json" || file === ".gitattributes") result.obsidianConfig.push(change);
    else if ([...folders].some((folder) => file.startsWith(`${folder}/`))) result.noteAttachments.push(change);
    else result.otherFiles.push(change);
  }
  return result;
}

// src/policy.ts
var import_node_fs4 = require("node:fs");
var import_node_path5 = __toESM(require("node:path"));
var GENERATED_START = "# BEGIN GITHUB VAULT SYNC";
var GENERATED_END = "# END GITHUB VAULT SYNC";
var TEXT_ATTRIBUTE_LINES = [
  "* text=auto",
  "*.md text eol=lf",
  "*.markdown text eol=lf",
  "*.json text eol=lf",
  "*.yaml text eol=lf",
  "*.yml text eol=lf",
  "*.css text eol=lf",
  "*.js text eol=lf",
  "*.ts text eol=lf",
  "*.mjs text eol=lf",
  "*.cjs text eol=lf",
  "*.txt text eol=lf"
];
function generatedBlock(patterns) {
  return [
    GENERATED_START,
    "# Generated by GitHub Vault Sync.",
    ...TEXT_ATTRIBUTE_LINES,
    ...patterns.map((pattern) => `${normalizeRelPath(pattern)} filter=lfs diff=lfs merge=lfs -text`),
    GENERATED_END
  ];
}
function isLegacyGeneratedLine(line) {
  return line === "# Generated by GitHub Vault Sync. Manual additions are preserved only if they are outside this block." || TEXT_ATTRIBUTE_LINES.includes(line);
}
function attributesForPatterns(patterns, existing = "") {
  const nextBlock = generatedBlock(patterns);
  const existingLines = existing.replace(/\r\n/g, "\n").split("\n");
  while (existingLines.length && existingLines[existingLines.length - 1] === "") existingLines.pop();
  const start = existingLines.indexOf(GENERATED_START);
  const end = start >= 0 ? existingLines.indexOf(GENERATED_END, start + 1) : -1;
  if (start >= 0 && end >= start) {
    const merged2 = [...existingLines.slice(0, start), ...nextBlock, ...existingLines.slice(end + 1)];
    return `${merged2.join("\n").replace(/\n+$/, "")}
`;
  }
  const preserved = existingLines.filter((line) => !isLegacyGeneratedLine(line));
  const merged = [...preserved, ...preserved.length ? [""] : [], ...nextBlock];
  return `${merged.join("\n")}
`;
}
async function writeSyncPolicy(vaultPath, settings) {
  const manifestPath = getManifestPath(vaultPath);
  await writeJsonFile(manifestPath, createSyncManifest(settings));
  const attributesPath = import_node_path5.default.join(vaultPath, GIT_ATTRIBUTES);
  let existing = "";
  try {
    existing = await import_node_fs4.promises.readFile(attributesPath, "utf8");
  } catch (e) {
  }
  await import_node_fs4.promises.writeFile(attributesPath, attributesForPatterns(settings.lfsPatterns, existing), "utf8");
}
async function readSyncPolicy(vaultPath) {
  try {
    const content = await import_node_fs4.promises.readFile(import_node_path5.default.join(vaultPath, SYNC_MANIFEST), "utf8");
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}
function localExcludeEntries(settings) {
  const patterns = [
    ".git/",
    ".trash/",
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...settings.includeObsidian ? [] : [".obsidian/"],
    ...settings.excludePatterns
  ];
  return [...new Set(patterns.flatMap((pattern) => pattern.endsWith("/**") ? [pattern, `${pattern.slice(0, -3)}/`] : [pattern]))];
}
async function ensureConflictDirectory(vaultPath, settings, sessionFolder) {
  if (!isSafeRelativePath(settings.conflictFolder) || !isSafeRelativePath(sessionFolder)) {
    throw new Error("Conflict backup folder must remain inside the vault");
  }
  const folder = import_node_path5.default.join(vaultPath, settings.conflictFolder, sessionFolder);
  await ensureDirectory(folder);
  return folder;
}

// src/sync-engine.ts
var SyncEngine = class {
  constructor(vaultPath, settings, saveSettings, onSnapshot, onLog) {
    this.vaultPath = vaultPath;
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.onSnapshot = onSnapshot;
    this.onLog = onLog;
    this.scanResult = null;
    this.snapshot = {
      phase: "idle",
      health: "unconfigured",
      message: "Not configured",
      changedFiles: [],
      conflicts: [],
      warnings: []
    };
    this.git = new GitService(vaultPath, settings);
    if (settings.pendingMerge) {
      this.snapshot = {
        ...this.snapshot,
        phase: "waiting-conflicts",
        health: "conflicts",
        message: `${settings.pendingMerge.conflicts.length} conflict(s) need resolution`,
        conflicts: settings.pendingMerge.conflicts
      };
    } else if (settings.repo) {
      this.snapshot = {
        ...this.snapshot,
        health: settings.lastStatus === "unconfigured" ? "checking" : settings.lastStatus,
        message: settings.lastStatus === "synced" ? "\u4E0A\u6B21\u540C\u6B65\u5B8C\u6210\uFF0C\u6B63\u5728\u7B49\u5F85\u68C0\u67E5" : "\u4ED3\u5E93\u5DF2\u7ED1\u5B9A\uFF0C\u7B49\u5F85\u72B6\u6001\u68C0\u67E5"
      };
    }
  }
  getSnapshot() {
    return {
      ...this.snapshot,
      difference: this.snapshot.difference ? { ...this.snapshot.difference } : void 0,
      changedFiles: [...this.snapshot.changedFiles],
      conflicts: [...this.snapshot.conflicts],
      warnings: [...this.snapshot.warnings]
    };
  }
  async persist() {
    await this.saveSettings();
  }
  log(level, message) {
    this.onLog(level, message);
  }
  update(patch) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onSnapshot(this.getSnapshot());
    return this.snapshot;
  }
  errorMessage(error) {
    if (error instanceof Error) return error.message;
    return String(error);
  }
  async dependencies() {
    const dependencies = await this.git.dependencies();
    if (!dependencies.git.available) {
      this.update({ health: "dependencies-missing", phase: "error", message: "Git is not installed", error: dependencies.git.error });
    }
    return dependencies;
  }
  async scan() {
    this.update({
      phase: "scanning",
      health: "checking",
      message: "Scanning vault\u2026",
      progress: void 0,
      progressDetail: void 0,
      error: void 0
    });
    try {
      const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
      if (encrypted.needsRestore) throw new Error("Remote encrypted settings are newer; restore or resolve them before uploading");
      this.scanResult = await scanVault(this.vaultPath, this.settings);
      this.update({
        phase: "idle",
        health: this.scanResult.errors.length || this.scanResult.caseCollisions.length || this.scanResult.windowsPathIssues.length ? "error" : "checking",
        message: `Scanned ${this.scanResult.files.length} files (${formatBytes(this.scanResult.includedBytes)} included)`,
        changedFiles: [],
        warnings: [...this.scanResult.warnings, ...this.scanResult.sensitive.map((file) => `Excluded sensitive file: ${file.path}`)]
      });
      return this.scanResult;
    } catch (error) {
      const message = this.errorMessage(error);
      this.update({ phase: "error", health: "error", message, error: message });
      throw error;
    }
  }
  progressFromGit(transfer) {
    const label = transfer.kind === "lfs" ? "Git LFS \u9644\u4EF6" : "Git \u63D0\u4EA4\u5BF9\u8C61";
    this.update({
      phase: "uploading",
      progress: transfer.percent,
      progressDetail: `${label} ${transfer.completed}/${transfer.total}\uFF08\u6309\u5BF9\u8C61\u6570\uFF09`
    });
  }
  async pushWithProgress(branch) {
    this.update({ phase: "uploading", progress: void 0, progressDetail: "\u6B63\u5728\u5411 GitHub \u4E0A\u4F20\uFF0C\u7B49\u5F85 Git \u62A5\u544A\u8FDB\u5EA6\u2026" });
    await this.git.push(branch, (transfer) => this.progressFromGit(transfer));
    this.update({ progress: 100, progressDetail: "\u4E0A\u4F20\u6210\u529F\uFF0C\u6B63\u5728\u786E\u8BA4\u72B6\u6001\u2026" });
  }
  async finishRemotePull() {
    const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
    if (!encrypted.needsRestore) return this.complete("Pulled remote changes");
    const message = "\u8FDC\u7AEF\u52A0\u5BC6\u914D\u7F6E\u5DF2\u4E0B\u8F7D\uFF1B\u8BF7\u5148\u7528\u6062\u590D\u5BC6\u94A5\u624B\u52A8\u6062\u590D\uFF0C\u518D\u7EE7\u7EED\u4E0A\u4F20";
    this.settings.lastStatus = "remote-changes";
    await this.persist();
    this.update({
      phase: "idle",
      health: "remote-changes",
      message,
      progress: void 0,
      progressDetail: void 0,
      encryptedNeedsRestore: true
    });
    return { ok: true, message, changedFiles: [], conflicts: [], warnings: [] };
  }
  async validatedRemotePaths(remoteRef) {
    const remoteFiles = await this.git.treePaths(remoteRef);
    const forbidden = [...DEFAULT_EXCLUDE_PATTERNS, ...this.settings.includeObsidian ? [] : [".obsidian/**"], ...this.settings.excludePatterns];
    for (const file of remoteFiles) {
      if (!isSafeRelativePath(file) || matchesAnyPattern(file, forbidden) || isLikelySensitivePath(file)) {
        throw new Error(`Remote contains an excluded or unsafe path: ${file}. Review the repository before pulling.`);
      }
    }
    return remoteFiles;
  }
  async compareWithRemote(remoteRef, scan) {
    const remoteFiles = await this.validatedRemotePaths(remoteRef);
    const localFiles = new Set(scan.included.map((file) => file.path));
    const status = await this.git.status();
    const base = await this.git.mergeBase("HEAD", remoteRef);
    const localChanged = base ? changedPaths(await this.git.changedEntries(base, "HEAD")) : await this.git.treePaths("HEAD");
    const remoteChanged = base ? changedPaths(await this.git.changedEntries(base, remoteRef)) : new Set(remoteFiles);
    for (const entry of status) {
      localChanged.add(entry.path);
      if (entry.oldPath) localChanged.add(entry.oldPath);
    }
    const difference = summarizeDifference(localFiles, remoteFiles, localChanged, remoteChanged);
    const fileMap = new Map(scan.included.map((file) => [file.path, file]));
    const changedFiles = [.../* @__PURE__ */ new Set([...localChanged, ...remoteChanged])].sort().map((file) => {
      var _a, _b;
      return {
        path: file,
        kind: !localFiles.has(file) || !remoteFiles.has(file) ? "added" : ((_a = fileMap.get(file)) == null ? void 0 : _a.isLfs) ? "binary" : "modified",
        localStatus: localChanged.has(file) ? "changed" : void 0,
        remoteStatus: remoteChanged.has(file) ? "changed" : void 0,
        size: (_b = fileMap.get(file)) == null ? void 0 : _b.size
      };
    });
    return { difference, changedFiles };
  }
  async ensureDependencies(requireLfs) {
    const dependencies = await this.dependencies();
    if (!dependencies.git.available) throw new Error("Git is required. Install Git and retry.");
    if (requireLfs && !dependencies.gitLfs.available) {
      throw new Error("Git LFS is required for one or more attachments. Install Git LFS and retry.");
    }
    if (requireLfs) {
      await this.git.ensureLfsInitialized();
    }
  }
  validateScan(scan) {
    if (scan.errors.length) throw new Error(scan.errors.join("\n"));
    if (scan.caseCollisions.length) throw new Error(`Case-insensitive path collisions detected:
${scan.caseCollisions.map((paths) => paths.join(" \u2194 ")).join("\n")}`);
    if (scan.windowsPathIssues.length) throw new Error(`Windows-incompatible paths detected:
${scan.windowsPathIssues.slice(0, 20).join("\n")}`);
  }
  async ensureRepo(binding) {
    var _a;
    await this.git.init(this.settings.branch || binding.branch || "main");
    await this.git.setRemote(binding);
    const previousPolicy = await readSyncPolicy(this.vaultPath);
    await this.git.writeLocalExclude(localExcludeEntries(this.settings), (_a = previousPolicy == null ? void 0 : previousPolicy.excludePatterns) != null ? _a : []);
  }
  async configureRepository(binding, direction) {
    this.settings.repo = { ...binding, branch: this.settings.branch || binding.branch || "main" };
    this.settings.branch = this.settings.repo.branch;
    this.settings.lastError = "";
    await this.persist();
    this.update({ phase: "checking", health: "checking", message: "Preparing repository\u2026", warnings: [], error: void 0 });
    try {
      const scan = await this.scan();
      this.validateScan(scan);
      await this.ensureRepo(this.settings.repo);
      await this.ensureDependencies(scan.lfsFiles.length > 0 || scan.included.some((file) => file.size > 100 * 1024 * 1024));
      const remoteExists = await this.git.remoteBranchExists(this.settings.branch);
      if (!remoteExists) {
        await writeSyncPolicy(this.vaultPath, this.settings);
        const committed2 = await this.git.commitWorkingTree("Initialize vault sync");
        if (!committed2) await this.git.commit("Initialize vault sync", true);
        await this.pushWithProgress(this.settings.branch);
        const sha = await this.git.headSha();
        this.settings.lastRemoteSha = sha != null ? sha : "";
        this.settings.lastStatus = "synced";
        await this.persist();
        return this.complete("Repository initialized from local vault", scan.warnings);
      }
      await this.git.fetch(this.settings.branch);
      await this.validatedRemotePaths(`origin/${this.settings.branch}`);
      if (direction === "remote") {
        const backup = await this.backupIncludedFiles(scan);
        await this.git.cleanIncludedFiles(scan.included.map((file) => file.path));
        await this.git.run(["checkout", "-B", this.settings.branch, `origin/${this.settings.branch}`]);
        const sha = await this.git.headSha();
        this.settings.lastRemoteSha = sha != null ? sha : "";
        this.settings.lastStatus = "synced";
        await this.persist();
        return this.complete(`Restored remote vault. Local backup: ${backup}`, scan.warnings);
      }
      await writeSyncPolicy(this.vaultPath, this.settings);
      const committed = await this.git.commitWorkingTree("Initialize local vault sync");
      if (!committed && !await this.git.hasHead()) await this.git.commit("Initialize local vault sync", true);
      const result = await this.reconcileAndPush("Initial repository binding");
      return result;
    } catch (error) {
      return this.fail(error);
    }
  }
  async backupIncludedFiles(scan) {
    const parent = import_node_path6.default.dirname(this.vaultPath);
    const name = import_node_path6.default.basename(this.vaultPath);
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const destination = import_node_path6.default.join(parent, `${name} GitHub Vault Sync Backup ${stamp}`);
    await ensureDirectory(destination);
    for (const file of scan.included) {
      const target = import_node_path6.default.join(destination, file.path);
      await ensureDirectory(import_node_path6.default.dirname(target));
      await import_node_fs5.promises.copyFile(file.absolutePath, target);
    }
    return destination;
  }
  async reconcileAndPush(message, priority = "manual", approvedRemoteSha) {
    var _a, _b, _c;
    if (!await this.git.remoteBranchExists(this.settings.branch)) {
      await this.pushWithProgress(this.settings.branch);
      this.settings.lastRemoteSha = (_a = await this.git.headSha()) != null ? _a : "";
      this.settings.lastStatus = "synced";
      await this.persist();
      return this.complete(message);
    }
    await this.git.fetch(this.settings.branch);
    const remoteRef = `origin/${this.settings.branch}`;
    const remoteSha = await this.git.refSha(remoteRef);
    if (approvedRemoteSha && remoteSha !== approvedRemoteSha) {
      throw new Error("The repository changed during synchronization. Local changes were checkpointed; review the remote branch before pushing.");
    }
    if (remoteSha) await this.validatedRemotePaths(remoteRef);
    const headSha = await this.git.headSha();
    if (!remoteSha || !headSha) {
      await this.pushWithProgress(this.settings.branch);
      return this.complete(message);
    }
    if (remoteSha === headSha) {
      this.settings.lastRemoteSha = remoteSha;
      this.settings.lastStatus = "synced";
      await this.persist();
      return this.complete(message);
    }
    const state = await this.git.branchAheadBehind("HEAD", remoteRef);
    if (state.behind === 0) {
      await this.pushWithProgress(this.settings.branch);
      this.settings.lastRemoteSha = (_b = await this.git.headSha()) != null ? _b : remoteSha;
      this.settings.lastStatus = "synced";
      await this.persist();
      return this.complete(message);
    }
    if (state.ahead === 0) {
      await this.git.fastForward(remoteRef);
      this.settings.lastRemoteSha = (_c = await this.git.headSha()) != null ? _c : remoteSha;
      this.settings.lastStatus = "synced";
      await this.persist();
      return await this.finishRemotePull();
    }
    return this.beginMerge(remoteRef, message, priority);
  }
  async changedPathSet(base, ref, includeAllWhenNoBase) {
    if (base) {
      const entries = await this.git.changedEntries(base, ref);
      const paths = /* @__PURE__ */ new Set();
      for (const entry of entries) {
        paths.add(entry.path);
        if (entry.oldPath) paths.add(entry.oldPath);
      }
      return paths;
    }
    if (!includeAllWhenNoBase) return /* @__PURE__ */ new Set();
    return await this.git.treePaths(ref);
  }
  async mergeEntries(base, ref) {
    if (base) return this.git.changedEntries(base, ref);
    const paths = await this.git.treePaths(ref);
    return Array.from(paths).map((entry) => ({ status: "A", path: entry }));
  }
  async beginMerge(remoteRef, message, priority = "manual") {
    var _a, _b;
    this.update({ phase: "merging", health: "checking", message: "Preparing file-level merge\u2026", error: void 0 });
    const remoteSha = (_a = await this.git.refSha(remoteRef)) != null ? _a : "";
    const baseSha = await this.git.mergeBase("HEAD", remoteRef);
    const localPaths = await this.changedPathSet(baseSha, "HEAD", true);
    const remotePaths = await this.changedPathSet(baseSha, remoteRef, true);
    const conflicts = /* @__PURE__ */ new Set();
    for (const value of localPaths) if (remotePaths.has(value)) conflicts.add(value);
    const localEntries = await this.mergeEntries(baseSha, "HEAD");
    const remoteEntries = await this.mergeEntries(baseSha, remoteRef);
    if (localEntries.some((entry) => entry.status === "R") || remoteEntries.some((entry) => entry.status === "R")) {
      for (const entry of localEntries.filter((item) => item.status === "R")) {
        conflicts.add(entry.path);
        if (entry.oldPath) conflicts.add(entry.oldPath);
      }
      for (const entry of remoteEntries.filter((item) => item.status === "R")) {
        conflicts.add(entry.path);
        if (entry.oldPath) conflicts.add(entry.oldPath);
      }
    }
    await this.git.beginOursMerge(remoteRef, !baseSha);
    const localOnly = new Set([...localPaths].filter((value) => !remotePaths.has(value)));
    const remoteOnly = new Set([...remotePaths].filter((value) => !localPaths.has(value)));
    for (const entry of remoteEntries) {
      const paths = [entry.path, ...entry.oldPath ? [entry.oldPath] : []];
      if (!paths.some((value) => remoteOnly.has(value))) continue;
      if (entry.status === "D") {
        await this.git.removeWorkingPath(entry.path);
      } else if (entry.status === "R" && entry.oldPath) {
        await this.git.removeWorkingPath(entry.oldPath);
        await this.git.checkoutPath(remoteRef, entry.path);
      } else {
        await this.git.checkoutPath(remoteRef, entry.path);
      }
    }
    await this.git.addAll();
    const conflictItems = [];
    for (const relPath of conflicts) {
      const localExists = await this.git.pathExistsInRef("HEAD", relPath);
      const remoteExists = await this.git.pathExistsInRef(remoteRef, relPath);
      const localInfo = localExists ? await this.git.fileSizeAndHash("HEAD", relPath) : null;
      const remoteInfo = remoteExists ? await this.git.fileSizeAndHash(remoteRef, relPath) : null;
      conflictItems.push({
        path: relPath,
        localRef: "HEAD",
        remoteRef,
        localExists,
        remoteExists,
        localHash: localInfo == null ? void 0 : localInfo.hash,
        remoteHash: remoteInfo == null ? void 0 : remoteInfo.hash,
        localSize: localInfo == null ? void 0 : localInfo.size,
        remoteSize: remoteInfo == null ? void 0 : remoteInfo.size,
        // The preview's preference applies only to Markdown notes. Plugin
        // configs, encrypted bundles and binary attachments need a file-level
        // choice rather than silently inheriting that preference.
        choice: priority !== "manual" && isMarkdownNote(relPath) ? priority : null
      });
    }
    if (!conflictItems.length) {
      await this.git.commitMerge(message);
      await this.pushWithProgress(this.settings.branch);
      this.settings.lastRemoteSha = (_b = await this.git.headSha()) != null ? _b : remoteSha;
      this.settings.lastStatus = "synced";
      await this.persist();
      return this.complete("Merged and uploaded remote changes");
    }
    const sessionFolder = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    await ensureConflictDirectory(this.vaultPath, this.settings, sessionFolder);
    const pending = {
      remoteRef,
      remoteSha,
      baseSha,
      conflicts: conflictItems,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sessionFolder
    };
    this.settings.pendingMerge = pending;
    this.settings.lastStatus = "conflicts";
    await this.persist();
    this.update({
      phase: "waiting-conflicts",
      health: "conflicts",
      message: `${conflictItems.length} conflict(s) need a file-level choice`,
      conflicts: conflictItems,
      changedFiles: [],
      warnings: []
    });
    if (conflictItems.every((item) => item.choice)) {
      const choices = Object.fromEntries(conflictItems.map((item) => [item.path, item.choice]));
      return await this.resolvePending(choices);
    }
    return {
      ok: false,
      message: "Conflicts need resolution",
      changedFiles: [],
      conflicts: conflictItems,
      warnings: []
    };
  }
  async resolvePending(choices) {
    var _a, _b;
    const pending = this.settings.pendingMerge;
    if (!pending) throw new Error("There is no pending merge");
    this.update({ phase: "merging", health: "conflicts", message: "Applying conflict choices\u2026" });
    try {
      const conflictFolder = await ensureConflictDirectory(this.vaultPath, this.settings, pending.sessionFolder);
      for (const conflict of pending.conflicts) {
        const choice = (_a = choices[conflict.path]) != null ? _a : conflict.choice;
        if (!choice) throw new Error(`Choose a version for ${conflict.path}`);
        await this.applyConflictChoice(conflict, choice, conflictFolder);
      }
      await this.git.commitMerge("Sync remote changes");
      await this.pushWithProgress(this.settings.branch);
      this.settings.pendingMerge = null;
      this.settings.lastRemoteSha = (_b = await this.git.headSha()) != null ? _b : pending.remoteSha;
      this.settings.lastStatus = "synced";
      await this.persist();
      return this.complete("Conflicts resolved and changes uploaded");
    } catch (error) {
      return this.fail(error);
    }
  }
  async applyConflictChoice(conflict, choice, conflictFolder) {
    if (!isSafeRelativePath(conflict.path)) throw new Error(`Unsafe conflict path: ${conflict.path}`);
    const copyVersion = async (ref, suffix) => {
      const target = import_node_path6.default.join(conflictFolder, `${conflict.path}.${suffix}`);
      await ensureDirectory(import_node_path6.default.dirname(target));
      const blob = await this.git.showFile(ref, conflict.path);
      try {
        await import_node_fs5.promises.writeFile(target, blob, { flag: "wx" });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!(await import_node_fs5.promises.readFile(target)).equals(blob)) throw new Error(`Conflict backup changed: ${target}`);
      }
    };
    if (conflict.remoteExists && (choice === "local" || choice === "both")) {
      await copyVersion(conflict.remoteRef, "remote");
    }
    if (conflict.localExists && (choice === "remote" || choice === "both")) {
      await copyVersion(conflict.localRef, "local");
    }
    if (choice === "local") {
      if (conflict.localExists) await this.git.checkoutPath(conflict.localRef, conflict.path);
      else await this.git.removeWorkingPath(conflict.path);
    } else if (choice === "remote") {
      if (conflict.remoteExists) await this.git.checkoutPath(conflict.remoteRef, conflict.path);
      else await this.git.removeWorkingPath(conflict.path);
    } else {
      if (conflict.localExists) {
        await this.git.checkoutPath(conflict.localRef, conflict.path);
      } else if (conflict.remoteExists) {
        await this.git.checkoutPath(conflict.remoteRef, conflict.path);
      } else {
        await this.git.removeWorkingPath(conflict.path);
      }
    }
  }
  async abortPending() {
    if (!this.settings.pendingMerge) return this.complete("No pending merge");
    try {
      await this.git.abortMerge();
      const session = this.settings.pendingMerge.sessionFolder;
      this.settings.pendingMerge = null;
      this.settings.lastStatus = "local-changes";
      await this.persist();
      this.update({ phase: "idle", health: "local-changes", message: `Merge aborted; conflict copies remain in ${this.settings.conflictFolder}/${session}` });
      return { ok: true, message: "Merge aborted", changedFiles: [], conflicts: [], warnings: [] };
    } catch (error) {
      return this.fail(error);
    }
  }
  async saveLocalCheckpoint() {
    try {
      const scan = await this.scan();
      this.validateScan(scan);
      await this.ensureDependencies(scan.lfsFiles.length > 0 || scan.included.some((file) => file.size > 100 * 1024 * 1024));
      if (!this.settings.repo) throw new Error("Bind a GitHub repository first");
      await this.ensureRepo(this.settings.repo);
      await writeSyncPolicy(this.vaultPath, this.settings);
      const committed = await this.git.commitWorkingTree(`Local checkpoint ${(/* @__PURE__ */ new Date()).toISOString()}`);
      if (!committed) return this.complete("No local changes to checkpoint");
      this.settings.lastStatus = "local-changes";
      await this.persist();
      return this.complete("Local changes checkpointed");
    } catch (error) {
      return this.fail(error);
    }
  }
  async upload(priority = "manual", approvedRemoteSha) {
    if (!this.settings.repo) throw new Error("Bind a GitHub repository first");
    if (this.settings.pendingMerge) return this.conflictResult();
    this.update({
      phase: "uploading",
      health: "checking",
      message: "Preparing local upload\u2026",
      progress: 0,
      progressDetail: "\u51C6\u5907\u626B\u63CF Vault\u2026",
      error: void 0
    });
    try {
      const scan = await this.scan();
      this.validateScan(scan);
      await this.ensureDependencies(scan.lfsFiles.length > 0 || scan.included.some((file) => file.size > 100 * 1024 * 1024));
      await this.ensureRepo(this.settings.repo);
      await writeSyncPolicy(this.vaultPath, this.settings);
      this.update({ phase: "staging", progress: 0, progressDetail: "\u6B63\u5728\u68C0\u67E5\u5E76\u6682\u5B58\u672C\u5730\u6587\u4EF6\u2026" });
      const committed = await this.git.commitWorkingTree(`Sync local changes ${(/* @__PURE__ */ new Date()).toISOString()}`, (done, total) => {
        this.update({
          phase: "staging",
          progress: Math.round(done / total * 100),
          progressDetail: `\u672C\u5730\u6587\u4EF6\u5DF2\u6682\u5B58 ${done}/${total}`
        });
      });
      if (!committed) return await this.reconcileAndPush("No local changes to upload", priority, approvedRemoteSha);
      return await this.reconcileAndPush("Local changes uploaded", priority, approvedRemoteSha);
    } catch (error) {
      return this.fail(error);
    }
  }
  async pull() {
    if (!this.settings.repo) throw new Error("Bind a GitHub repository first");
    if (this.settings.pendingMerge) return this.conflictResult();
    this.update({ phase: "pulling", health: "checking", message: "Checking remote changes\u2026", error: void 0 });
    try {
      const status = await this.git.status();
      if (status.length) throw new Error("Local files have uncommitted changes. Create a local checkpoint before pulling.");
      await this.ensureRepo(this.settings.repo);
      await this.ensureDependencies(false);
      const exists = await this.git.remoteBranchExists(this.settings.branch);
      if (!exists) throw new Error(`Remote branch ${this.settings.branch} does not exist`);
      await this.git.fetch(this.settings.branch);
      const remoteRef = `origin/${this.settings.branch}`;
      const remoteSha = await this.git.refSha(remoteRef);
      if (remoteSha) await this.validatedRemotePaths(remoteRef);
      const headSha = await this.git.headSha();
      if (remoteSha && remoteSha === headSha) return this.complete("Already up to date");
      if (!headSha && remoteSha) {
        await this.git.run(["checkout", "-B", this.settings.branch, remoteRef]);
        this.settings.lastRemoteSha = remoteSha;
        this.settings.lastStatus = "synced";
        await this.persist();
        return await this.finishRemotePull();
      }
      if (!remoteSha) throw new Error("Remote branch has no commit");
      return await this.reconcileAndPush("Remote changes pulled");
    } catch (error) {
      return this.fail(error);
    }
  }
  async checkRemote() {
    if (!this.settings.repo) return this.complete("No repository configured");
    if (this.settings.pendingMerge) return this.conflictResult();
    this.update({
      phase: "checking",
      health: "checking",
      message: "Checking GitHub\u2026",
      progress: void 0,
      progressDetail: void 0,
      error: void 0
    });
    try {
      await this.ensureRepo(this.settings.repo);
      const deps = await this.dependencies();
      if (!deps.git.available) throw new Error("Git is required");
      const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
      await this.git.fetch(this.settings.branch);
      const remoteRef = `origin/${this.settings.branch}`;
      const remoteSha = await this.git.refSha(remoteRef);
      if (!remoteSha) throw new Error(`Remote branch ${this.settings.branch} does not exist`);
      const scan = await scanVault(this.vaultPath, this.settings);
      this.validateScan(scan);
      this.scanResult = scan;
      const { difference, changedFiles } = await this.compareWithRemote(remoteRef, scan);
      const health = encrypted.needsRestore || difference.remoteChanged > 0 ? "remote-changes" : difference.localChanged > 0 ? "local-changes" : "synced";
      const message = encrypted.needsRestore ? "\u52A0\u5BC6\u914D\u7F6E\u5305\u6709\u8FDC\u7AEF\u66F4\u65B0\uFF0C\u9700\u624B\u52A8\u6062\u590D\u540E\u518D\u4E0A\u4F20" : `\u672C\u5730\u53D8\u5316 ${difference.localChanged} \xB7 \u8FDC\u7AEF\u53D8\u5316 ${difference.remoteChanged} \xB7 \u6587\u4EF6\u5DEE\u5F02 ${difference.differencePercent}%`;
      this.settings.lastStatus = health;
      this.settings.lastRemoteSha = remoteSha;
      this.settings.lastError = "";
      await this.persist();
      const warnings = [...scan.warnings, ...scan.sensitive.map((file) => `Excluded sensitive file: ${file.path}`)];
      this.update({
        phase: "idle",
        health,
        message,
        difference,
        changedFiles,
        warnings,
        encryptedNeedsRestore: encrypted.needsRestore,
        error: void 0
      });
      return { ok: true, message, changedFiles, conflicts: [], warnings };
    } catch (error) {
      return this.fail(error);
    }
  }
  async localFingerprint() {
    const digest = (0, import_node_crypto3.createHash)("sha256");
    digest.update(JSON.stringify({
      head: await this.git.headSha(),
      branch: this.settings.branch,
      includeObsidian: this.settings.includeObsidian,
      excluded: this.settings.excludePatterns,
      lfs: this.settings.lfsPatterns,
      encrypted: this.settings.encryptedSyncEnabled,
      encryptedFolders: this.settings.encryptedFolders,
      encryptedDigest: this.settings.encryptionLastDigest
    }));
    const status = (await this.git.status()).sort((a, b) => a.path.localeCompare(b.path));
    for (const entry of status) {
      digest.update(JSON.stringify(entry));
      for (const rel of [entry.path, ...entry.oldPath ? [entry.oldPath] : []]) {
        if (!isSafeRelativePath(rel)) throw new Error(`Unsafe changed file path: ${rel}`);
        try {
          const absolute = import_node_path6.default.join(this.vaultPath, rel);
          const info = await import_node_fs5.promises.lstat(absolute);
          if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Changed path is not a regular file: ${rel}`);
          digest.update(`${rel}:${await sha256File(absolute)}`);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          digest.update(`${rel}:missing`);
        }
      }
    }
    return digest.digest("hex");
  }
  async previewSync() {
    var _a, _b;
    if (!this.settings.repo) throw new Error("Bind a private repository first");
    if (this.settings.pendingMerge) throw new Error("Resolve the previous conflicts before starting another sync");
    const result = await this.checkRemote();
    if (!result.ok || !this.snapshot.difference || !this.settings.lastRemoteSha) {
      throw new Error(result.message || "Could not compare the local vault and repository");
    }
    if (this.snapshot.encryptedNeedsRestore) {
      throw new Error("\u5148\u6062\u590D\u8FDC\u7AEF\u52A0\u5BC6\u914D\u7F6E\uFF0C\u518D\u8FDB\u884C\u7B14\u8BB0\u540C\u6B65");
    }
    const groups = categorizeChanges(
      result.changedFiles,
      (_b = (_a = this.scanResult) == null ? void 0 : _a.included.map((file) => file.path).filter(isMarkdownNote)) != null ? _b : []
    );
    return {
      remoteSha: this.settings.lastRemoteSha,
      localFingerprint: await this.localFingerprint(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      priority: null,
      ...groups,
      difference: { ...this.snapshot.difference },
      warnings: [...this.snapshot.warnings]
    };
  }
  async syncApproved(preview, priority) {
    if (!["local", "remote", "manual"].includes(priority)) throw new Error("Select a note conflict priority");
    if (this.settings.pendingMerge) return this.conflictResult();
    try {
      await this.git.fetch(this.settings.branch);
      const remoteSha = await this.git.refSha(`origin/${this.settings.branch}`);
      if (remoteSha !== preview.remoteSha) {
        throw new Error("The repository changed after the preview. Review its latest files before syncing.");
      }
      const encrypted = await prepareEncryptedBundle(this.vaultPath, this.settings);
      if (encrypted.needsRestore) throw new Error("Remote encrypted settings changed; restore and review them before uploading.");
      if (await this.localFingerprint() !== preview.localFingerprint) {
        throw new Error("Local notes or sync settings changed after the preview. Review the latest files before syncing.");
      }
      return await this.upload(priority, preview.remoteSha);
    } catch (error) {
      return this.fail(error);
    }
  }
  conflictResult() {
    var _a, _b;
    const conflicts = (_b = (_a = this.settings.pendingMerge) == null ? void 0 : _a.conflicts) != null ? _b : [];
    this.update({ phase: "waiting-conflicts", health: "conflicts", message: `${conflicts.length} conflict(s) need resolution`, conflicts });
    return { ok: false, message: "Conflicts need resolution", changedFiles: [], conflicts, warnings: [] };
  }
  complete(message, warnings = []) {
    var _a, _b, _c, _d;
    this.settings.lastError = "";
    this.update({
      phase: "completed",
      health: "synced",
      message,
      warnings,
      progress: 100,
      progressDetail: "\u540C\u6B65\u5B8C\u6210",
      changedFiles: [],
      encryptedNeedsRestore: false,
      difference: {
        localChanged: 0,
        remoteChanged: 0,
        differingPaths: 0,
        totalPaths: (_d = (_c = (_a = this.scanResult) == null ? void 0 : _a.included.length) != null ? _c : (_b = this.snapshot.difference) == null ? void 0 : _b.totalPaths) != null ? _d : 0,
        differencePercent: 0,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      error: void 0,
      conflicts: []
    });
    return { ok: true, message, changedFiles: this.snapshot.changedFiles, conflicts: [], warnings };
  }
  async restoreEncryptedSettings(restoreSelf = false) {
    if (!this.settings.encryptionKey) throw new Error("Import a recovery key before restoring");
    try {
      const restored = await restoreEncryptedBundle(this.vaultPath, this.settings, restoreSelf);
      if (restoreSelf) {
        const own = JSON.parse(await import_node_fs5.promises.readFile(import_node_path6.default.join(this.vaultPath, ".obsidian", "plugins", "github-vault-sync", "data.json"), "utf8"));
        Object.assign(this.settings, own);
      }
      this.settings.lastStatus = "synced";
      await this.persist();
      const message = `\u5DF2\u6062\u590D ${restored.restored} \u4E2A\u52A0\u5BC6\u6587\u4EF6\uFF1B\u8986\u76D6\u524D\u7684\u5907\u4EFD\uFF1A${restored.backup}\u3002\u8BF7\u91CD\u542F Obsidian\u3002`;
      this.update({ phase: "idle", health: "synced", message, encryptedNeedsRestore: false });
      return { ok: true, message, changedFiles: [], conflicts: [], warnings: [] };
    } catch (error) {
      return this.fail(error);
    }
  }
  async fail(error) {
    var _a, _b;
    const message = this.errorMessage(error);
    this.settings.lastError = message;
    this.settings.lastStatus = this.settings.pendingMerge ? "conflicts" : "error";
    await this.persist();
    this.log("error", message);
    this.update({
      phase: "error",
      health: this.settings.pendingMerge ? "conflicts" : "error",
      message,
      progress: void 0,
      progressDetail: void 0,
      error: message
    });
    return { ok: false, message, changedFiles: [], conflicts: (_b = (_a = this.settings.pendingMerge) == null ? void 0 : _a.conflicts) != null ? _b : [], warnings: [] };
  }
};

// src/main.ts
function vaultBasePath(app) {
  var _a, _b;
  const adapter = app.vault.adapter;
  const basePath = (_b = (_a = adapter.getBasePath) == null ? void 0 : _a.call(adapter)) != null ? _b : adapter.basePath;
  if (!basePath) throw new Error("Unable to determine the local Vault path");
  return basePath;
}
function repoNameFromVault(vaultPath) {
  const raw = import_node_path7.default.basename(vaultPath).normalize("NFKC").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return (raw || "obsidian-vault").slice(0, 90);
}
function healthLabel(health) {
  const labels = {
    unconfigured: "\u672A\u914D\u7F6E",
    "dependencies-missing": "\u4F9D\u8D56\u7F3A\u5931",
    unauthenticated: "\u672A\u767B\u5F55",
    checking: "\u68C0\u67E5\u4E2D",
    "local-changes": "\u672C\u5730\u6709\u4FEE\u6539",
    "remote-changes": "\u8FDC\u7AEF\u6709\u66F4\u65B0",
    conflicts: "\u5B58\u5728\u51B2\u7A81",
    synced: "\u540C\u6B65\u5B8C\u6210",
    error: "\u540C\u6B65\u5931\u8D25"
  };
  return labels[health];
}
function renderSyncSummary(container, snapshot) {
  var _a, _b;
  container.empty();
  const phase = container.createDiv({ cls: "github-vault-sync-summary-title" });
  const synced = snapshot.difference && snapshot.difference.differingPaths === 0 && (snapshot.phase === "completed" || snapshot.phase === "idle");
  phase.setText(synced ? `\u672C\u673A\u4E0E\u4ED3\u5E93\u4E00\u81F4 \xB7 ${(_b = (_a = snapshot.difference) == null ? void 0 : _a.totalPaths) != null ? _b : 0} \u4E2A\u6587\u4EF6` : snapshot.progressDetail || snapshot.message);
  if (snapshot.phase === "staging" || snapshot.phase === "uploading" || snapshot.phase === "scanning" || snapshot.phase === "fetching") {
    const progress = document.createElement("progress");
    progress.className = "github-vault-sync-progress";
    progress.max = 100;
    if (snapshot.progress !== void 0) progress.value = snapshot.progress;
    progress.setAttribute("aria-label", snapshot.progressDetail || "\u540C\u6B65\u8FDB\u884C\u4E2D");
    container.appendChild(progress);
    if (snapshot.progress !== void 0) container.createEl("small", { text: `\u5F53\u524D\u9636\u6BB5 ${snapshot.progress}%` });
  }
  if (snapshot.difference) {
    const diff = snapshot.difference;
    if (!synced) {
      container.createEl("p", {
        cls: "setting-item-description",
        text: `\u672C\u5730\u53D8\u5316 ${diff.localChanged} \xB7 \u4ED3\u5E93\u53D8\u5316 ${diff.remoteChanged} \xB7 \u5DEE\u5F02 ${diff.differingPaths}/${diff.totalPaths} \u4E2A\u6587\u4EF6\uFF08${diff.differencePercent}%\uFF09`
      });
      container.createEl("small", { text: "\u6309\u6587\u4EF6\u8DEF\u5F84\u7EDF\u8BA1\uFF0C\u4E0D\u662F\u7B14\u8BB0\u6587\u5B57\u76F8\u4F3C\u5EA6\u3002" });
    }
  }
  if (snapshot.encryptedNeedsRestore) {
    container.createEl("p", {
      cls: "github-vault-sync-error-text",
      text: "\u8FDC\u7AEF\u52A0\u5BC6\u914D\u7F6E\u5DF2\u66F4\u65B0\uFF1B\u8BF7\u5BFC\u5165\u6062\u590D\u5BC6\u94A5\u5E76\u624B\u52A8\u6062\u590D\uFF0C\u81EA\u52A8\u540C\u6B65\u6682\u65F6\u6682\u505C\u3002"
    });
  }
  if (snapshot.changedFiles.length) {
    const list = container.createEl("ul", { cls: "github-vault-sync-change-list" });
    for (const item of snapshot.changedFiles.slice(0, 12)) {
      list.createEl("li", { text: `${item.localStatus ? "\u672C\u5730 " : ""}${item.remoteStatus ? "\u8FDC\u7AEF " : ""}${item.path}` });
    }
    if (snapshot.changedFiles.length > 12) list.createEl("li", { text: `\u53E6\u5916 ${snapshot.changedFiles.length - 12} \u4E2A\u6587\u4EF6\u2026` });
  }
}
var GithubVaultSyncPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS, excludePatterns: [...DEFAULT_SETTINGS.excludePatterns], lfsPatterns: [...DEFAULT_SETTINGS.lfsPatterns] };
    this.vaultPath = "";
    this.actionRunning = false;
    this.autoTimer = null;
    this.autoPending = false;
    this.lastAutoAlert = "";
    this.snapshotListeners = /* @__PURE__ */ new Set();
  }
  async onload() {
    const loaded = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...loaded != null ? loaded : {}, excludePatterns: [...DEFAULT_SETTINGS.excludePatterns], lfsPatterns: [...DEFAULT_SETTINGS.lfsPatterns] };
    if (loaded == null ? void 0 : loaded.excludePatterns) this.settings.excludePatterns = loaded.excludePatterns;
    if (loaded == null ? void 0 : loaded.lfsPatterns) this.settings.lfsPatterns = loaded.lfsPatterns;
    this.vaultPath = vaultBasePath(this.app);
    this.engine = new SyncEngine(
      this.vaultPath,
      this.settings,
      async () => this.saveSensitiveSettings(),
      (snapshot) => this.updateStatus(snapshot),
      (level, message) => this.addLog(level, message)
    );
    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("github-vault-sync-status");
    this.statusBar.setAttribute("role", "button");
    this.statusBar.setAttribute("tabindex", "0");
    this.statusBar.addEventListener("click", () => this.openSyncCenter());
    this.statusBar.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.openSyncCenter();
      }
    });
    this.updateStatus(this.engine.getSnapshot());
    this.addSettingTab(new GithubVaultSyncSettingTab(this.app, this));
    this.addCommand({ id: "connect-github", name: "\u8FDE\u63A5 GitHub", callback: () => void this.connectGithub() });
    this.addCommand({ id: "bind-repository", name: "\u521B\u5EFA\u6216\u7ED1\u5B9A\u540C\u6B65\u4ED3\u5E93", callback: () => void this.bindRepository() });
    this.addCommand({ id: "scan-changes", name: "\u626B\u63CF\u672C\u5730/\u8FDC\u7AEF\u53D8\u5316", callback: () => void this.runAction("scan", () => this.engine.checkRemote()) });
    this.addCommand({ id: "sync-now", name: "\u9884\u89C8\u5E76\u540C\u6B65\u7B14\u8BB0", callback: () => void this.syncNow() });
    this.addCommand({ id: "open-sync-center", name: "\u6253\u5F00\u540C\u6B65\u4E2D\u5FC3", callback: () => this.openSyncCenter() });
    this.addCommand({ id: "check-dependencies", name: "\u91CD\u65B0\u68C0\u6D4B Git/Git LFS", callback: () => void this.checkDependencies() });
    this.addCommand({ id: "restore-encrypted-settings", name: "\u6062\u590D\u52A0\u5BC6\u7684\u63D2\u4EF6\u914D\u7F6E", callback: () => void this.restorePrivateSettings() });
    this.addCommand({ id: "open-sync-log", name: "\u67E5\u770B\u540C\u6B65\u65E5\u5FD7", callback: () => this.openLogs() });
    this.addCommand({ id: "disconnect-repository", name: "\u65AD\u5F00\u4ED3\u5E93\u4E0E\u6E05\u9664\u51ED\u636E", callback: () => void this.disconnect() });
    this.addRibbonIcon("git-branch", "GitHub Vault Sync", () => this.openSyncCenter());
    this.registerEvent(this.app.vault.on("modify", (file) => this.scheduleAutoSync(file.path)));
    this.registerEvent(this.app.vault.on("create", (file) => this.scheduleAutoSync(file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.scheduleAutoSync(file.path)));
    this.registerEvent(this.app.vault.on("rename", (file, previous) => {
      this.scheduleAutoSync(file.path);
      this.scheduleAutoSync(previous);
    }));
    this.registerInterval(window.setInterval(() => void this.pollAutomaticSync(), 5 * 60 * 1e3));
    this.register(() => {
      if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
      this.snapshotListeners.clear();
    });
    window.setTimeout(() => {
      if (this.settings.startupCheck && this.settings.repo) void this.startupCheck();
    }, 1800);
  }
  onunload() {
  }
  async saveSensitiveSettings() {
    await this.saveData(this.settings);
    await import_node_fs6.promises.chmod(import_node_path7.default.join(this.vaultPath, ".obsidian", "plugins", "github-vault-sync", "data.json"), 384);
  }
  async startupCheck() {
    await this.runAction("startup-check", () => this.engine.checkRemote(), false);
    const snapshot = this.engine.getSnapshot();
    if (this.settings.autoSyncEnabled) this.notifyReviewNeeded(snapshot);
    if (snapshot.health === "conflicts") {
      this.openConflicts();
    }
  }
  updateStatus(snapshot) {
    if (this.statusBar) {
      this.statusBar.setText(`GitHub Sync \xB7 ${healthLabel(snapshot.health)}`);
      this.statusBar.setAttribute("aria-label", snapshot.message);
      this.statusBar.toggleClass("github-vault-sync-error", snapshot.health === "error");
      this.statusBar.toggleClass("github-vault-sync-conflict", snapshot.health === "conflicts");
    }
    for (const listener of this.snapshotListeners) listener(snapshot);
  }
  subscribeSnapshot(listener) {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }
  isBusy() {
    return this.actionRunning;
  }
  remoteExecutableChangesNeedReview() {
    const snapshot = this.engine.getSnapshot();
    return Boolean(snapshot.encryptedNeedsRestore) || snapshot.changedFiles.some((item) => Boolean(item.remoteStatus) && (/^\.obsidian\/(?:plugins|themes)\//.test(item.path) || item.path === ENCRYPTED_BUNDLE));
  }
  notifyReviewNeeded(snapshot) {
    var _a, _b, _c;
    if (!this.settings.autoSyncEnabled || snapshot.health === "synced") {
      this.lastAutoAlert = "";
      return;
    }
    if (snapshot.health === "error" || snapshot.health === "checking" || snapshot.health === "conflicts") return;
    const fingerprint = `${this.settings.lastRemoteSha}:${(_a = snapshot.difference) == null ? void 0 : _a.localChanged}:${(_b = snapshot.difference) == null ? void 0 : _b.remoteChanged}:${(_c = snapshot.difference) == null ? void 0 : _c.differingPaths}:${snapshot.encryptedNeedsRestore}`;
    if (fingerprint === this.lastAutoAlert) return;
    this.lastAutoAlert = fingerprint;
    const warning = this.remoteExecutableChangesNeedReview() ? "\u8FDC\u7AEF\u63D2\u4EF6\u4EE3\u7801\u6216\u52A0\u5BC6\u914D\u7F6E\u5F85\u4EBA\u5DE5\u5BA1\u6838\u3002" : "";
    new import_obsidian2.Notice(`GitHub Vault Sync\uFF1A\u68C0\u6D4B\u5230\u53D8\u5316\uFF0C\u8BF7\u70B9\u201C\u9884\u89C8\u5E76\u540C\u6B65\u201D\u786E\u8BA4\u672C\u673A/\u4ED3\u5E93\u4F18\u5148\u3002${warning}`, 8e3);
  }
  async setAutoSyncEnabled(enabled) {
    this.settings.autoSyncEnabled = enabled;
    await this.saveSensitiveSettings();
    if (enabled) this.scheduleAutoSync();
    else if (this.autoTimer !== null) {
      window.clearTimeout(this.autoTimer);
      this.autoTimer = null;
      this.autoPending = false;
    }
  }
  async enableEncryptedSync() {
    var _a, _b, _c;
    try {
      if (!((_a = this.settings.repo) == null ? void 0 : _a.private)) throw new Error("\u5148\u7ED1\u5B9A GitHub \u79C1\u6709\u4ED3\u5E93");
      const previousKey = this.settings.encryptionKey;
      const previousFolders = [...(_b = this.settings.encryptedFolders) != null ? _b : []];
      try {
        if (!this.settings.encryptionKey) this.settings.encryptionKey = generateRecoveryKey();
        if (!((_c = this.settings.encryptedFolders) == null ? void 0 : _c.length)) {
          this.settings.encryptedFolders = ["obsidian-memos", "obsidian-callout-editor"];
        }
        const recoveryPath = await writeRecoveryKeyFile(this.settings);
        this.settings.encryptedSyncEnabled = true;
        await this.saveSensitiveSettings();
        new RecoveryKeyModal(this.app, this.settings.encryptionKey, recoveryPath).open();
        this.scheduleAutoSync();
      } catch (error) {
        this.settings.encryptionKey = previousKey;
        this.settings.encryptedFolders = previousFolders;
        throw error;
      }
    } catch (error) {
      new import_obsidian2.Notice(`\u52A0\u5BC6\u540C\u6B65\u672A\u542F\u7528\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
    }
  }
  async importEncryptedKey(input) {
    var _a, _b;
    try {
      const key = validateRecoveryKey(input);
      if (this.settings.encryptionKey && this.settings.encryptionKey !== key) {
        throw new Error("\u5DF2\u6709\u53E6\u4E00\u628A\u672C\u5730\u5BC6\u94A5\uFF1B\u4E0D\u80FD\u76F4\u63A5\u8986\u76D6\uFF0C\u5426\u5219\u65E7\u5907\u4EFD\u5C06\u65E0\u6CD5\u6062\u590D");
      }
      if (!((_a = this.settings.repo) == null ? void 0 : _a.private)) throw new Error("\u8BF7\u5148\u7ED1\u5B9A\u76F8\u540C\u7684\u79C1\u6709\u4ED3\u5E93");
      const previous = this.settings.encryptionKey;
      this.settings.encryptionKey = key;
      try {
        if (!((_b = this.settings.encryptedFolders) == null ? void 0 : _b.length)) this.settings.encryptedFolders = ["obsidian-memos", "obsidian-callout-editor"];
        const recoveryPath = await writeRecoveryKeyFile(this.settings);
        this.settings.encryptedSyncEnabled = true;
        await this.saveSensitiveSettings();
        new import_obsidian2.Notice(`\u6062\u590D\u5BC6\u94A5\u5DF2\u5BFC\u5165\u5E76\u4FDD\u5B58\u5230\u672C\u673A\uFF1A${recoveryPath}`, 8e3);
      } catch (error) {
        this.settings.encryptionKey = previous;
        throw error;
      }
    } catch (error) {
      new import_obsidian2.Notice(`\u5BFC\u5165\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
    }
  }
  async showRecoveryFile() {
    try {
      const file = await writeRecoveryKeyFile(this.settings);
      new RecoveryKeyModal(this.app, this.settings.encryptionKey, file).open();
    } catch (error) {
      new import_obsidian2.Notice(`\u65E0\u6CD5\u5BFC\u51FA\u6062\u590D\u5BC6\u94A5\uFF1A${error instanceof Error ? error.message : String(error)}`, 8e3);
    }
  }
  async restorePrivateSettings(restoreSelf = false) {
    if (!this.settings.encryptionKey) {
      new import_obsidian2.Notice("\u5148\u4ECE\u53E6\u4E00\u53F0\u8BBE\u5907\u5BFC\u5165\u6062\u590D\u5BC6\u94A5\uFF0C\u4E0D\u8981\u628A\u5BC6\u94A5\u53D1\u5230\u804A\u5929\u4E2D\u3002");
      return;
    }
    try {
      const details = await inspectEncryptedBundle(this.vaultPath, this.settings);
      new ConfirmModal(
        this.app,
        "\u6062\u590D\u52A0\u5BC6\u914D\u7F6E",
        `\u5C06\u89E3\u5BC6 ${details.files} \u4E2A\u6587\u4EF6\uFF08${formatBytes(details.totalBytes)}\uFF09\uFF0C\u8986\u76D6\u63D2\u4EF6\u914D\u7F6E\u4E0E\u4F8B\u5916\u63D2\u4EF6\u6587\u4EF6\u3002${restoreSelf ? "\u8B66\u544A\uFF1A\u672C\u63D2\u4EF6\u7684 GitHub PAT \u548C\u540C\u6B65\u8BBE\u7F6E\u4E5F\u4F1A\u88AB\u8986\u76D6\u3002" : "\u672C\u63D2\u4EF6\u7684\u5F53\u524D\u767B\u5F55\u51ED\u636E\u4FDD\u6301\u4E0D\u53D8\u3002"}\u8986\u76D6\u524D\u4F1A\u5907\u4EFD\u539F\u6587\u4EF6\uFF1B\u5B8C\u6210\u540E\u9700\u91CD\u542F Obsidian\u3002`,
        async () => {
          await this.runAction("restore-encrypted", () => this.engine.restoreEncryptedSettings(restoreSelf));
        }
      ).open();
    } catch (error) {
      new import_obsidian2.Notice(`\u65E0\u6CD5\u8BFB\u53D6\u52A0\u5BC6\u5305\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
    }
  }
  scheduleAutoSync(filePath) {
    if (!this.settings.autoSyncEnabled || !this.settings.repo || !this.settings.token || this.settings.pendingMerge) return;
    if (filePath && (matchesAnyPattern(filePath, [
      ...DEFAULT_EXCLUDE_PATTERNS,
      ...this.settings.includeObsidian ? [] : [".obsidian/**"],
      ...this.settings.excludePatterns
    ]) || isLikelySensitivePath(filePath) || filePath === ".github-vault-sync.json" || filePath === ".gitattributes")) return;
    if (this.actionRunning) {
      this.autoPending = true;
      return;
    }
    if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
    const seconds = Math.max(30, Math.min(600, Number(this.settings.autoSyncDelaySeconds) || 90));
    this.autoTimer = window.setTimeout(() => {
      this.autoTimer = null;
      void this.checkForReview();
    }, seconds * 1e3);
  }
  async checkForReview() {
    const result = await this.runAction("auto-check", () => this.engine.checkRemote(), false);
    if (result && "ok" in result && result.ok) this.notifyReviewNeeded(this.engine.getSnapshot());
  }
  async pollAutomaticSync() {
    if (!this.settings.autoSyncEnabled || !this.settings.repo || !this.settings.token || this.settings.pendingMerge || this.actionRunning) return;
    await this.checkForReview();
  }
  addLog(level, message) {
    const token = this.settings.token;
    const redacted = token ? message.split(token).join("[REDACTED]") : message;
    this.settings.logEntries = [...this.settings.logEntries, { at: (/* @__PURE__ */ new Date()).toISOString(), level, message: redacted }].slice(-200);
    void this.saveSensitiveSettings();
  }
  async runAction(name, action, notify = true) {
    if (this.actionRunning) {
      new import_obsidian2.Notice("GitHub Vault Sync\uFF1A\u5DF2\u6709\u540C\u6B65\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\u3002");
      return null;
    }
    this.actionRunning = true;
    this.addLog("info", `Starting ${name}`);
    try {
      const result = await action();
      if (notify && "message" in result) {
        new import_obsidian2.Notice(`GitHub Vault Sync\uFF1A${result.message}`, result.ok ? 4e3 : 8e3);
      }
      if ("conflicts" in result && result.conflicts.length) this.openConflicts();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.addLog("error", `${name}: ${message}`);
      new import_obsidian2.Notice(`GitHub Vault Sync\uFF1A${message}`, 1e4);
      return null;
    } finally {
      this.actionRunning = false;
      if (this.autoPending) {
        this.autoPending = false;
        this.scheduleAutoSync();
      }
    }
  }
  async syncNow() {
    if (this.actionRunning) {
      new import_obsidian2.Notice("\u5DF2\u6709\u540C\u6B65\u68C0\u67E5\u6B63\u5728\u8FD0\u884C\uFF0C\u8BF7\u7A0D\u5019\u3002");
      return;
    }
    this.actionRunning = true;
    try {
      const preview = await this.engine.previewSync();
      new SyncPreviewModal(this.app, preview, async (priority) => {
        const result = await this.runAction("confirmed-sync", () => this.engine.syncApproved(preview, priority));
        if (result && "ok" in result && result.ok) this.lastAutoAlert = "";
      }, async (file) => this.openNoteComparison(file, preview.remoteSha)).open();
    } catch (error) {
      new import_obsidian2.Notice(`\u65E0\u6CD5\u751F\u6210\u540C\u6B65\u9884\u89C8\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
    } finally {
      this.actionRunning = false;
    }
  }
  async openNoteComparison(relPath, remoteSha) {
    var _a;
    if (!isMarkdownNote(relPath) || !isSafeRelativePath(relPath) || import_node_path7.default.isAbsolute(relPath)) {
      new import_obsidian2.Notice("\u4EC5\u652F\u6301\u6BD4\u8F83 Vault \u5185\u7684 Markdown \u7B14\u8BB0\u3002");
      return;
    }
    const maxLength = 12e4;
    const readLocal = async () => {
      try {
        const absolute = import_node_path7.default.join(this.vaultPath, relPath);
        const [file, stat] = await Promise.all([import_node_fs6.promises.readFile(absolute), import_node_fs6.promises.stat(absolute)]);
        return {
          text: file.includes(0) ? "[\u6B64\u6587\u4EF6\u5305\u542B\u4E8C\u8FDB\u5236\u6570\u636E\uFF0C\u65E0\u6CD5\u5B89\u5168\u663E\u793A\u6587\u672C]" : file.toString("utf8").slice(0, maxLength),
          modified: `\u672C\u673A\u6587\u4EF6\u65F6\u95F4\uFF1A${formatDateTime(new Date(stat.mtimeMs))}`
        };
      } catch (error) {
        if (error.code === "ENOENT") return { text: "[\u672C\u8BBE\u5907\u4E0D\u5B58\u5728\u6216\u5DF2\u5220\u9664]", modified: "\u672C\u673A\u65E0\u6587\u4EF6" };
        throw error;
      }
    };
    try {
      const local = await readLocal();
      const exists = await this.engine.git.pathExistsInRef(remoteSha, relPath);
      const remote = exists ? await this.engine.git.showFile(remoteSha, relPath) : null;
      const remoteText = remote ? remote.includes(0) ? "[\u4ED3\u5E93\u6587\u4EF6\u5305\u542B\u4E8C\u8FDB\u5236\u6570\u636E\uFF0C\u65E0\u6CD5\u663E\u793A\u6587\u672C]" : remote.toString("utf8").slice(0, maxLength) : "[\u4ED3\u5E93\u4E2D\u4E0D\u5B58\u5728\u6216\u5DF2\u5220\u9664]";
      const commitTime = (_a = await this.engine.git.tryText(["log", "-1", "--format=%cI", remoteSha, "--", relPath])) == null ? void 0 : _a.trim();
      new NoteComparisonModal(
        this.app,
        relPath,
        local.text,
        remoteText,
        remoteSha.slice(0, 12),
        local.modified,
        commitTime ? `\u4ED3\u5E93\u63D0\u4EA4\u65F6\u95F4\uFF1A${formatDateTime(commitTime)}` : "\u4ED3\u5E93\u65E0\u5BF9\u5E94\u63D0\u4EA4\u65F6\u95F4"
      ).open();
    } catch (error) {
      new import_obsidian2.Notice(`\u65E0\u6CD5\u52A0\u8F7D\u7B14\u8BB0\u5BF9\u7167\uFF1A${error instanceof Error ? error.message : String(error)}`, 8e3);
    }
  }
  async connectGithub() {
    const currentClient = new GithubClient(this.settings);
    const modal = new AuthModal(this.app, this.settings.oauthClientId, Boolean(this.settings.token), async (action) => {
      var _a, _b;
      modal.close();
      if (action.type === "pat") {
        const token = ((_a = action.token) != null ? _a : "").trim();
        if (!token) return;
        try {
          const user = await currentClient.validateToken(token);
          this.settings.token = token;
          this.settings.authType = "pat";
          this.settings.lastStatus = this.settings.repo ? this.settings.lastStatus : "unauthenticated";
          await this.saveSensitiveSettings();
          new import_obsidian2.Notice(`\u5DF2\u8FDE\u63A5 GitHub\uFF1A${user.login}`);
          this.addLog("info", `Authenticated with PAT as ${user.login}`);
        } catch (error) {
          new import_obsidian2.Notice(`GitHub PAT \u9A8C\u8BC1\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
        }
        return;
      }
      if (action.type === "oauth") {
        this.settings.oauthClientId = ((_b = action.clientId) != null ? _b : "").trim();
        await this.saveSensitiveSettings();
        await this.startDeviceAuthorization();
      }
    });
    modal.open();
  }
  async startDeviceAuthorization() {
    const client = new GithubClient(this.settings);
    try {
      const code = await client.startDeviceFlow(this.settings.oauthClientId);
      const modal = new DeviceCodeModal(this.app, code.user_code, code.verification_uri, code.verification_uri_complete);
      modal.open();
      const token = await client.pollDeviceFlow(this.settings.oauthClientId, code, (seconds) => modal.setStatus(`\u7B49\u5F85\u6388\u6743\u4E2D\uFF0C\u5C06\u5728\u7EA6 ${seconds} \u79D2\u540E\u91CD\u8BD5\u2026`));
      modal.close();
      this.settings.token = token;
      this.settings.authType = "oauth";
      const user = await client.getAuthenticatedUser();
      await this.saveSensitiveSettings();
      this.addLog("info", `Authenticated with OAuth as ${user.login}`);
      new import_obsidian2.Notice(`\u5DF2\u8FDE\u63A5 GitHub\uFF1A${user.login}`);
    } catch (error) {
      new import_obsidian2.Notice(`GitHub OAuth \u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
    }
  }
  async bindRepository() {
    if (!this.settings.token) {
      new import_obsidian2.Notice("\u8BF7\u5148\u8FDE\u63A5 GitHub\u3002");
      await this.connectGithub();
      return;
    }
    const client = new GithubClient(this.settings);
    let userLogin = "";
    try {
      userLogin = (await client.getAuthenticatedUser()).login;
    } catch (error) {
      new import_obsidian2.Notice(`GitHub \u767B\u5F55\u5DF2\u5931\u6548\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
      return;
    }
    const modal = new RepositoryModal(this.app, userLogin, repoNameFromVault(this.vaultPath), async (action) => {
      modal.close();
      try {
        let binding;
        if (action.type === "create") {
          const repo = await client.createPrivateRepository(action.name);
          binding = await client.bindRepository(repo.owner.login, repo.name);
        } else {
          binding = await client.bindRepository(action.owner, action.name);
        }
        const scan = await this.engine.scan();
        const preview = new InitialBindingModal(this.app, binding, scan, async (direction) => {
          preview.close();
          const result = await this.runAction("bind-repository", () => this.engine.configureRepository(binding, direction));
          if (result && "conflicts" in result && result.conflicts.length) this.openConflicts();
        });
        preview.open();
      } catch (error) {
        new import_obsidian2.Notice(`\u4ED3\u5E93\u7ED1\u5B9A\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
      }
    });
    modal.open();
  }
  async checkDependencies() {
    try {
      const status = await this.engine.dependencies();
      new DependencyModal(this.app, status).open();
    } catch (error) {
      new import_obsidian2.Notice(`\u4F9D\u8D56\u68C0\u6D4B\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, 1e4);
    }
  }
  openSyncCenter() {
    new SyncCenterModal(this.app, this).open();
  }
  openConflicts() {
    var _a, _b;
    const conflicts = (_b = (_a = this.settings.pendingMerge) == null ? void 0 : _a.conflicts) != null ? _b : this.engine.getSnapshot().conflicts;
    if (!conflicts.length) {
      new import_obsidian2.Notice("\u5F53\u524D\u6CA1\u6709\u5F85\u5904\u7406\u51B2\u7A81\u3002");
      return;
    }
    new ConflictModal(this.app, conflicts, async (choices) => {
      const result = await this.runAction("resolve-conflicts", () => this.engine.resolvePending(choices));
      if (result && "ok" in result && result.ok) this.openSyncCenter();
    }).open();
  }
  openLogs() {
    new TextModal(this.app, "GitHub Vault Sync \u65E5\u5FD7", this.settings.logEntries.map((entry) => `[${formatDateTime(entry.at)}] ${entry.level.toUpperCase()} ${entry.message}`).join("\n")).open();
  }
  async disconnect() {
    new ConfirmModal(this.app, "\u65AD\u5F00\u540C\u6B65", "\u8FD9\u4F1A\u6E05\u9664\u63D2\u4EF6\u4E2D\u7684 GitHub \u4EE4\u724C\u548C\u4ED3\u5E93\u7ED1\u5B9A\uFF0C\u4F46\u4E0D\u4F1A\u5220\u9664 Vault \u4E2D\u7684 .git \u6216\u7B14\u8BB0\u3002", async () => {
      this.settings.token = "";
      this.settings.authType = null;
      this.settings.repo = null;
      this.settings.pendingMerge = null;
      this.settings.lastStatus = "unconfigured";
      await this.saveSensitiveSettings();
      this.updateStatus({ phase: "idle", health: "unconfigured", message: "Not configured", changedFiles: [], conflicts: [], warnings: [] });
      new import_obsidian2.Notice("\u5DF2\u6E05\u9664 GitHub \u51ED\u636E\u548C\u4ED3\u5E93\u7ED1\u5B9A\u3002");
    }).open();
  }
};
var GithubVaultSyncSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    var _a, _b;
    const { containerEl } = this;
    (_a = this.unsubscribe) == null ? void 0 : _a.call(this);
    containerEl.empty();
    containerEl.addClass("github-vault-sync-settings-page");
    const hero = containerEl.createDiv({ cls: "github-vault-sync-hero" });
    hero.createEl("h2", { text: "GitHub Vault Sync" });
    hero.createEl("p", { text: this.plugin.settings.repo ? `${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name} \xB7 ${this.plugin.settings.branch} \xB7 ${this.plugin.settings.repo.private ? "\u79C1\u6709\u4ED3\u5E93" : "\u4ED3\u5E93"}` : "\u5C1A\u672A\u8FDE\u63A5\u540C\u6B65\u4ED3\u5E93" });
    hero.createEl("small", { text: "\u5148\u770B\u7B14\u8BB0\u4E0E\u914D\u7F6E\u5DEE\u5F02\uFF0C\u518D\u9009\u51B2\u7A81\u4F18\u5148\u65B9\uFF1B\u672A\u7ECF\u786E\u8BA4\u4E0D\u4F1A\u4E0A\u4F20\u3002" });
    const overview = containerEl.createDiv({ cls: "github-vault-sync-panel github-vault-sync-panel-main" });
    overview.createEl("h3", { text: "\u7B14\u8BB0\u540C\u6B65" });
    new import_obsidian2.Setting(overview).setName("\u540C\u6B65\u524D\u9884\u89C8").setDesc("\u53EA\u8BFB\u68C0\u67E5 Markdown\u3001\u7B14\u8BB0\u9644\u4EF6\u548C Obsidian \u914D\u7F6E\uFF1B\u786E\u8BA4\u672C\u673A\uFF0F\u4ED3\u5E93\u4F18\u5148\u540E\u518D\u540C\u6B65\u3002").addButton((button) => button.setButtonText("\u9884\u89C8\u5E76\u540C\u6B65").setCta().setDisabled(!this.plugin.settings.repo || !this.plugin.settings.token).onClick(() => void this.plugin.syncNow()));
    const summary = overview.createDiv({ cls: "github-vault-sync-summary" });
    renderSyncSummary(summary, this.plugin.engine.getSnapshot());
    this.unsubscribe = this.plugin.subscribeSnapshot((snapshot) => renderSyncSummary(summary, snapshot));
    new import_obsidian2.Setting(overview).setName("\u53CA\u65F6\u68C0\u67E5").setDesc("\u672C\u5730\u53D8\u66F4\u540E\u9632\u6296\u68C0\u67E5\uFF0C\u53E6\u6BCF 5 \u5206\u949F\u68C0\u67E5\u8FDC\u7AEF\uFF1B\u68C0\u6D4B\u5230\u53D8\u5316\u4F1A\u63D0\u9192\u4F60\u9884\u89C8\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u4E0A\u4F20\u3002").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSyncEnabled).onChange(async (value) => this.plugin.setAutoSyncEnabled(value)));
    const privacy = containerEl.createDiv({ cls: "github-vault-sync-panel" });
    privacy.createEl("h3", { text: "\u9690\u79C1\u4E0E\u6062\u590D" });
    privacy.createEl("p", { text: this.plugin.settings.encryptedSyncEnabled ? "\u63D2\u4EF6\u79C1\u6709\u914D\u7F6E\u5DF2\u52A0\u5BC6\u955C\u50CF\u5230\u4ED3\u5E93\uFF1B\u6062\u590D\u5BC6\u94A5\u53EA\u5728\u672C\u673A\u3002\u8BF7\u5728\u522B\u5904\u5907\u4EFD\u5BC6\u94A5\u3002" : "\u53EF\u628A\u63D2\u4EF6 data.json \u4E0E\u4F8B\u5916\u63D2\u4EF6\u52A0\u5BC6\u6210\u4E00\u4E2A\u5BC6\u6587\u5305\uFF0C\u4E0D\u4E0A\u4F20\u660E\u6587\u51ED\u636E\u3002", cls: "setting-item-description" });
    new import_obsidian2.Setting(privacy).setName("\u6062\u590D\u5BC6\u94A5").setDesc("\u660E\u786E\u70B9\u51FB\u540E\u5728\u5F39\u7A97\u4E2D\u663E\u793A\uFF0C\u652F\u6301\u4E00\u952E\u590D\u5236\uFF1B\u5173\u95ED\u5F39\u7A97\u5373\u9690\u85CF\u3002").addButton((button) => button.setButtonText(this.plugin.settings.encryptedSyncEnabled ? "\u67E5\u770B\u5E76\u590D\u5236" : "\u542F\u7528\u52A0\u5BC6").setDisabled(!this.plugin.settings.repo).onClick(() => void (this.plugin.settings.encryptedSyncEnabled ? this.plugin.showRecoveryFile() : this.plugin.enableEncryptedSync())));
    if (!this.plugin.settings.encryptionKey) {
      let recoveryInput = "";
      new import_obsidian2.Setting(privacy).setName("\u5BFC\u5165\u5176\u4ED6\u8BBE\u5907\u7684\u5BC6\u94A5").addText((text) => {
        text.setPlaceholder("GVS1-\u2026").onChange((value) => {
          recoveryInput = value;
        });
        text.inputEl.type = "password";
      }).addButton((button) => button.setButtonText("\u5BFC\u5165").onClick(async () => {
        const input = recoveryInput;
        recoveryInput = "";
        await this.plugin.importEncryptedKey(input);
        this.display();
      }));
    }
    if (this.plugin.settings.encryptionKey) {
      new import_obsidian2.Setting(privacy).setName("\u4ECE\u4ED3\u5E93\u6062\u590D\u63D2\u4EF6\u8BBE\u7F6E").setDesc("\u5148\u5907\u4EFD\u518D\u89E3\u5BC6\uFF0C\u9ED8\u8BA4\u4E0D\u8986\u76D6\u672C\u673A GitHub \u767B\u5F55\uFF1B\u6062\u590D\u540E\u9700\u91CD\u542F\u3002").addButton((button) => button.setButtonText("\u89E3\u5BC6\u5E76\u6062\u590D").onClick(() => void this.plugin.restorePrivateSettings()));
    }
    const connection = containerEl.createEl("details", { cls: "github-vault-sync-details" });
    connection.open = !this.plugin.settings.repo || !this.plugin.settings.token;
    connection.createEl("summary", { text: "\u8D26\u6237\u4E0E\u4ED3\u5E93" });
    new import_obsidian2.Setting(connection).setName("GitHub \u767B\u5F55").setDesc(this.plugin.settings.token ? `\u5DF2\u8FDE\u63A5\uFF08${(_b = this.plugin.settings.authType) != null ? _b : "PAT"}\uFF09` : "\u672A\u8FDE\u63A5").addButton((button) => button.setButtonText("\u8FDE\u63A5\uFF0F\u66F4\u65B0").onClick(() => void this.plugin.connectGithub()));
    new import_obsidian2.Setting(connection).setName("\u7ED1\u5B9A\u4ED3\u5E93").setDesc(this.plugin.settings.repo ? `${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name}` : "\u5C1A\u672A\u7ED1\u5B9A").addButton((button) => button.setButtonText("\u521B\u5EFA\uFF0F\u7ED1\u5B9A").onClick(() => void this.plugin.bindRepository()));
    if (!this.plugin.settings.token || this.plugin.settings.authType === "oauth") {
      new import_obsidian2.Setting(connection).setName("OAuth Client ID").setDesc("\u4EC5\u5728\u4F7F\u7528\u6D4F\u89C8\u5668 Device Flow \u6388\u6743\u65F6\u9700\u8981\u3002").addText((text) => text.setValue(this.plugin.settings.oauthClientId).onChange(async (value) => {
        this.plugin.settings.oauthClientId = value.trim();
        await this.plugin.saveSensitiveSettings();
      }));
    }
    const advanced = containerEl.createEl("details", { cls: "github-vault-sync-details" });
    advanced.createEl("summary", { text: "\u9AD8\u7EA7\u9009\u9879\u4E0E\u6392\u9664\u89C4\u5219" });
    new import_obsidian2.Setting(advanced).setName("\u540C\u6B65 .obsidian \u8BBE\u7F6E").setDesc("\u63D2\u4EF6\u4EE3\u7801\u548C\u4E3B\u9898\u53EF\u540C\u6B65\uFF1Bdata.json \u660E\u6587\u59CB\u7EC8\u6392\u9664\uFF0C\u79C1\u6709\u914D\u7F6E\u53EA\u901A\u8FC7\u5BC6\u6587\u955C\u50CF\u540C\u6B65\u3002").addToggle((toggle) => toggle.setValue(this.plugin.settings.includeObsidian).onChange(async (value) => {
      this.plugin.settings.includeObsidian = value;
      await this.plugin.saveSensitiveSettings();
    }));
    new import_obsidian2.Setting(advanced).setName("\u68C0\u67E5\u5EF6\u8FDF\uFF08\u79D2\uFF09").setDesc("30\u2013600 \u79D2\uFF0C\u9ED8\u8BA4 90 \u79D2\u3002\u4E0A\u4F20\u4ECD\u9700\u9010\u6B21\u786E\u8BA4\u3002").addText((text) => text.setValue(String(this.plugin.settings.autoSyncDelaySeconds)).onChange(async (value) => {
      const seconds = Number.parseInt(value, 10);
      if (Number.isFinite(seconds) && seconds >= 30 && seconds <= 600) {
        this.plugin.settings.autoSyncDelaySeconds = seconds;
        await this.plugin.saveSensitiveSettings();
      }
    }));
    new import_obsidian2.Setting(advanced).setName("\u6392\u9664\u89C4\u5219").setDesc("\u6BCF\u884C\u4E00\u6761 glob\uFF1B\u51ED\u636E\u7C7B\u6587\u4EF6\u4E0E\u5F53\u524D\u63D2\u4EF6 data.json \u6C38\u8FDC\u4E0D\u4EE5\u660E\u6587\u63D0\u4EA4\u3002").addTextArea((area) => {
      area.inputEl.rows = 9;
      area.setValue(this.plugin.settings.excludePatterns.join("\n")).onChange(async (value) => {
        this.plugin.settings.excludePatterns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        await this.plugin.saveSensitiveSettings();
      });
    });
    new import_obsidian2.Setting(advanced).setName("Git LFS \u6587\u4EF6\u7C7B\u578B").setDesc("\u56FE\u7247\u3001\u89C6\u9891\u7B49\u9644\u4EF6\u6309\u8FD9\u4E9B\u6A21\u5F0F\u4F7F\u7528 Git LFS\u3002").addTextArea((area) => {
      area.inputEl.rows = 7;
      area.setValue(this.plugin.settings.lfsPatterns.join("\n")).onChange(async (value) => {
        this.plugin.settings.lfsPatterns = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        await this.plugin.saveSensitiveSettings();
      });
    });
    new import_obsidian2.Setting(advanced).setName("Git \u63D0\u4EA4\u4F5C\u8005").addText((text) => text.setValue(this.plugin.settings.gitUserName).onChange(async (value) => {
      this.plugin.settings.gitUserName = value.trim() || "GitHub Vault Sync";
      await this.plugin.saveSensitiveSettings();
    }));
    new import_obsidian2.Setting(advanced).setName("Git \u63D0\u4EA4\u90AE\u7BB1").addText((text) => text.setValue(this.plugin.settings.gitUserEmail).onChange(async (value) => {
      this.plugin.settings.gitUserEmail = value.trim() || "github-vault-sync@users.noreply.github.com";
      await this.plugin.saveSensitiveSettings();
    }));
    new import_obsidian2.Setting(advanced).setName("\u542F\u52A8\u65F6\u68C0\u67E5\u8FDC\u7AEF").addToggle((toggle) => toggle.setValue(this.plugin.settings.startupCheck).onChange(async (value) => {
      this.plugin.settings.startupCheck = value;
      await this.plugin.saveSensitiveSettings();
    }));
    new import_obsidian2.Setting(advanced).setName("\u5DE5\u5177").addButton((button) => button.setButtonText("\u68C0\u6D4B Git / LFS").onClick(() => void this.plugin["checkDependencies"]())).addButton((button) => button.setButtonText("\u67E5\u770B\u65E5\u5FD7").onClick(() => this.plugin.openLogs()));
    new import_obsidian2.Setting(advanced).setName("\u5B8C\u6574\u6062\u590D\u672C\u63D2\u4EF6\u767B\u5F55").setDesc("\u8C28\u614E\uFF1A\u89E3\u5BC6\u6062\u590D\u65F6\u8986\u76D6\u672C\u673A PAT\uFF0C\u9700\u518D\u6B21\u786E\u8BA4\u3002").addButton((button) => button.setButtonText("\u542B\u51ED\u636E\u6062\u590D").setWarning().setDisabled(!this.plugin.settings.encryptionKey).onClick(() => void this.plugin.restorePrivateSettings(true)));
  }
  hide() {
    var _a;
    (_a = this.unsubscribe) == null ? void 0 : _a.call(this);
    this.unsubscribe = void 0;
    super.hide();
  }
};
var AuthModal = class extends import_obsidian2.Modal {
  constructor(app, clientId, hasToken, onSubmit) {
    super(app);
    this.hasToken = hasToken;
    this.onSubmit = onSubmit;
    this.clientId = "";
    this.pat = "";
    this.clientId = clientId;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\u8FDE\u63A5 GitHub" });
    contentEl.createEl("p", { text: "\u9ED8\u8BA4\u901A\u8FC7\u6D4F\u89C8\u5668 Device Flow \u6388\u6743\uFF1B\u5982\u679C\u5C1A\u672A\u914D\u7F6E OAuth Client ID\uFF0C\u4E5F\u53EF\u4EE5\u7C98\u8D34 PAT\u3002\u4EE4\u724C\u53EA\u4FDD\u5B58\u5728\u672C\u5730\u63D2\u4EF6\u914D\u7F6E\u3002" });
    new import_obsidian2.Setting(contentEl).setName("OAuth Client ID").addText((text) => text.setValue(this.clientId).onChange((value) => {
      this.clientId = value;
    }));
    new import_obsidian2.Setting(contentEl).setName("PAT \u56DE\u9000").setDesc(this.hasToken ? "\u5DF2\u6709\u4EE4\u724C\uFF1B\u8F93\u5165\u65B0\u4EE4\u724C\u53EF\u66FF\u6362\u3002" : "\u5EFA\u8BAE\u4F7F\u7528\u5177\u5907\u79C1\u6709\u4ED3\u5E93\u8BFB\u5199\u6743\u9650\u7684\u4EE4\u724C\u3002").addText((text) => {
      text.setPlaceholder("github_pat_\u2026").onChange((value) => {
        this.pat = value;
      });
      text.inputEl.type = "password";
    });
    new import_obsidian2.Setting(contentEl).addButton((button) => button.setButtonText("\u6D4F\u89C8\u5668\u6388\u6743").setCta().onClick(() => void this.onSubmit({ type: "oauth", clientId: this.clientId }))).addButton((button) => button.setButtonText("\u4F7F\u7528 PAT").onClick(() => void this.onSubmit({ type: "pat", token: this.pat }))).addButton((button) => button.setButtonText("\u53D6\u6D88").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DeviceCodeModal = class extends import_obsidian2.Modal {
  constructor(app, userCode, verificationUri, completeUri) {
    super(app);
    this.userCode = userCode;
    this.verificationUri = verificationUri;
    this.completeUri = completeUri;
  }
  onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\u5728\u6D4F\u89C8\u5668\u4E2D\u6388\u6743 GitHub" });
    contentEl.createEl("p", { text: "\u6253\u5F00\u6388\u6743\u9875\u9762\u5E76\u8F93\u5165\u4EE5\u4E0B\u8BBE\u5907\u7801\u3002\u6388\u6743\u5B8C\u6210\u540E\u8BF7\u4FDD\u6301\u6B64\u7A97\u53E3\u6253\u5F00\u3002" });
    const code = contentEl.createEl("pre", { text: this.userCode, cls: "github-vault-sync-device-code" });
    code.setAttribute("aria-label", "GitHub device code");
    const link = contentEl.createEl("a", { text: this.verificationUri, href: (_a = this.completeUri) != null ? _a : this.verificationUri });
    link.setAttr("target", "_blank");
    new import_obsidian2.Setting(contentEl).addButton((button) => button.setButtonText("\u6253\u5F00\u6388\u6743\u9875\u9762").setCta().onClick(() => {
      var _a2;
      return window.open((_a2 = this.completeUri) != null ? _a2 : this.verificationUri, "_blank");
    })).addButton((button) => button.setButtonText("\u53D6\u6D88").onClick(() => this.close()));
    this.statusEl = contentEl.createEl("p", { text: "\u7B49\u5F85\u6388\u6743\u2026", cls: "setting-item-description" });
  }
  setStatus(message) {
    if (this.statusEl) this.statusEl.setText(message);
  }
};
var RepositoryModal = class extends import_obsidian2.Modal {
  constructor(app, defaultOwner, defaultName, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.owner = defaultOwner;
    this.name = defaultName;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\u521B\u5EFA\u6216\u7ED1\u5B9A\u79C1\u6709\u4ED3\u5E93" });
    new import_obsidian2.Setting(contentEl).setName("GitHub \u7528\u6237\u540D").addText((text) => text.setValue(this.owner).onChange((value) => {
      this.owner = value.trim();
    }));
    new import_obsidian2.Setting(contentEl).setName("\u4ED3\u5E93\u540D").addText((text) => text.setValue(this.name).onChange((value) => {
      this.name = value.trim();
    }));
    new import_obsidian2.Setting(contentEl).addButton((button) => button.setButtonText("\u521B\u5EFA\u79C1\u6709\u4ED3\u5E93").setCta().onClick(() => void this.onSubmit({ type: "create", name: this.name }))).addButton((button) => button.setButtonText("\u7ED1\u5B9A\u5DF2\u6709\u4ED3\u5E93").onClick(() => void this.onSubmit({ type: "bind", owner: this.owner, name: this.name }))).addButton((button) => button.setButtonText("\u53D6\u6D88").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var InitialBindingModal = class extends import_obsidian2.Modal {
  constructor(app, binding, scan, onSubmit) {
    super(app);
    this.binding = binding;
    this.scan = scan;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\u9996\u6B21\u7ED1\u5B9A\u9884\u68C0" });
    contentEl.createEl("p", { text: `${this.binding.owner}/${this.binding.name} \xB7 ${this.scan.files.length} \u4E2A\u672C\u5730\u6587\u4EF6 \xB7 ${formatBytes(this.scan.includedBytes)} \u5C06\u53C2\u4E0E\u540C\u6B65\u3002` });
    if (this.scan.warnings.length) {
      contentEl.createEl("h3", { text: "\u8B66\u544A" });
      const list = contentEl.createEl("ul");
      for (const warning of this.scan.warnings.slice(0, 20)) list.createEl("li", { text: warning });
    }
    contentEl.createEl("p", { text: "\u7EE7\u7EED\u524D\u8BF7\u9009\u62E9\u521D\u59CB\u65B9\u5411\u3002\u8FDC\u7AEF\u6062\u590D\u4F1A\u5148\u5907\u4EFD\u672C\u5730\u7EB3\u5165\u540C\u6B65\u7684\u6587\u4EF6\uFF1B\u672C\u5730\u53D1\u5E03\u4E0D\u4F1A\u5F3A\u5236\u8986\u76D6\u8FDC\u7AEF\u5386\u53F2\u3002" });
    new import_obsidian2.Setting(contentEl).addButton((button) => button.setButtonText("\u4EE5\u672C\u5730 Vault \u4E3A\u51C6").setCta().onClick(() => void this.onSubmit("local"))).addButton((button) => button.setButtonText("\u4ECE\u8FDC\u7AEF\u6062\u590D").onClick(() => void this.onSubmit("remote"))).addButton((button) => button.setButtonText("\u53D6\u6D88").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var SyncPreviewModal = class extends import_obsidian2.Modal {
  constructor(app, preview, onSubmit, onCompareNote) {
    super(app);
    this.preview = preview;
    this.onSubmit = onSubmit;
    this.onCompareNote = onCompareNote;
    this.selected = null;
  }
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("github-vault-sync-wide-modal");
    contentEl.empty();
    contentEl.addClass("github-vault-sync-preview");
    contentEl.createEl("h2", { text: "\u540C\u6B65\u524D\u786E\u8BA4" });
    contentEl.createEl("p", { text: "\u5148\u68C0\u67E5\u7B14\u8BB0\u548C\u7B14\u8BB0\u6587\u4EF6\u5939\uFF0C\u518D\u68C0\u67E5 Obsidian \u914D\u7F6E\u3002\u8BF7\u5148\u4FDD\u5B58\u6B63\u5728\u7F16\u8F91\u7684\u7B14\u8BB0\uFF1B\u6B64\u65F6\u5C1A\u672A\u63D0\u4EA4\u6216\u4E0A\u4F20\u3002" });
    const stats = contentEl.createDiv({ cls: "github-vault-sync-preview-metrics" });
    for (const [label, count] of [
      ["Markdown \u7B14\u8BB0", this.preview.notes.length],
      ["\u7B14\u8BB0\u6587\u4EF6\u5939\u9644\u4EF6", this.preview.noteAttachments.length],
      ["Obsidian \u914D\u7F6E", this.preview.obsidianConfig.length],
      ["\u5176\u4ED6\u6587\u4EF6", this.preview.otherFiles.length]
    ]) {
      const card = stats.createDiv({ cls: "github-vault-sync-preview-metric" });
      card.createEl("strong", { text: String(count) });
      card.createEl("span", { text: label });
    }
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `\u672C\u673A\u53D8\u5316 ${this.preview.difference.localChanged} \xB7 \u4ED3\u5E93\u53D8\u5316 ${this.preview.difference.remoteChanged} \xB7 \u6309\u6587\u4EF6\u8BA1\u7684\u5DEE\u5F02 ${this.preview.difference.differencePercent}%`
    });
    const groups = contentEl.createDiv({ cls: "github-vault-sync-preview-groups" });
    this.renderGroup(groups, "1 \xB7 Markdown \u7B14\u8BB0", this.preview.notes);
    this.renderGroup(groups, "2 \xB7 \u7B14\u8BB0\u6587\u4EF6\u5939\u9644\u4EF6", this.preview.noteAttachments);
    this.renderGroup(groups, "3 \xB7 Obsidian \u63D2\u4EF6\u4E0E\u914D\u7F6E", this.preview.obsidianConfig);
    this.renderGroup(groups, "4 \xB7 \u5176\u4ED6\u6587\u4EF6", this.preview.otherFiles);
    const advice = contentEl.createDiv({ cls: "github-vault-sync-preview-advice" });
    advice.createEl("strong", { text: "\u4F18\u5148\u65B9\u5F0F\u53EA\u5904\u7406\u201C\u540C\u4E00\u7BC7 Markdown \u4E24\u7AEF\u90FD\u6539\u8FC7\u201D\u7684\u51B2\u7A81" });
    advice.createEl("p", { text: "\u4E24\u7AEF\u5404\u81EA\u65B0\u589E\u6216\u4FEE\u6539\u7684\u4E0D\u540C\u6587\u4EF6\u4ECD\u4F1A\u5408\u5E76\uFF1B\u63D2\u4EF6\u914D\u7F6E\u3001\u52A0\u5BC6\u5305\u548C\u9644\u4EF6\u7684\u51B2\u7A81\u4E00\u5F8B\u9010\u9879\u786E\u8BA4\u3002\u4F18\u5148\u65B9\u5F0F\u4E0D\u662F\u6309\u8BBE\u5907\u65F6\u949F\u81EA\u52A8\u5224\u5B9A\u201C\u6700\u65B0\u201D\u3002\u672A\u9009\u4E2D\u7684\u7B14\u8BB0\u7248\u672C\u4F1A\u53E6\u5B58\u51B2\u7A81\u5907\u4EFD\uFF0C\u4E0D\u4F1A\u5F3A\u5236\u63A8\u9001\u3002" });
    let selected = "";
    new import_obsidian2.Setting(contentEl).setName("\u540C\u4E00\u7BC7\u7B14\u8BB0\u7684\u51B2\u7A81\u4F18\u5148\u65B9").addDropdown((dropdown) => dropdown.addOptions({
      "": "\u8BF7\u9009\u62E9\uFF0C\u4E0A\u4F20\u524D\u5FC5\u987B\u786E\u8BA4",
      local: "\u4EE5\u672C\u8BBE\u5907\u4E3A\u4E3B",
      remote: "\u4EE5 GitHub \u4ED3\u5E93\u4E3A\u4E3B",
      manual: "\u6BCF\u7BC7\u7B14\u8BB0\u9010\u9879\u9009\u62E9"
    }).setValue("").onChange((value) => {
      selected = value;
      this.selected = value ? value : null;
    }));
    if (this.preview.warnings.length) {
      const warning = contentEl.createEl("details");
      warning.createEl("summary", { text: `\u9884\u68C0\u63D0\u9192\uFF08${this.preview.warnings.length}\uFF09` });
      for (const message of this.preview.warnings.slice(0, 12)) warning.createEl("p", { text: message });
    }
    const actions = new import_obsidian2.Setting(contentEl);
    actions.addButton((button) => button.setButtonText("\u786E\u8BA4\u5E76\u540C\u6B65").setCta().onClick(async () => {
      if (!this.selected || !selected) {
        new import_obsidian2.Notice("\u5148\u9009\u62E9\u540C\u4E00\u7BC7\u7B14\u8BB0\u53D1\u751F\u51B2\u7A81\u65F6\u7684\u4F18\u5148\u65B9\u5F0F\u3002");
        return;
      }
      const priority = this.selected;
      this.close();
      await this.onSubmit(priority);
    }));
    actions.addButton((button) => button.setButtonText("\u53D6\u6D88\uFF0C\u4E0D\u4E0A\u4F20").onClick(() => this.close()));
  }
  renderGroup(container, title, files) {
    const group = container.createDiv({ cls: "github-vault-sync-preview-group" });
    group.createEl("h3", { text: `${title} \xB7 ${files.length}` });
    if (!files.length) {
      group.createEl("p", { text: "\u6CA1\u6709\u53D1\u73B0\u5DEE\u5F02", cls: "setting-item-description" });
      return;
    }
    const list = group.createEl("ul");
    for (const file of files.slice(0, 30)) {
      const side = file.localStatus && file.remoteStatus ? "\u4E24\u7AEF\u5747\u6709\u53D8\u5316" : file.localStatus ? "\u672C\u673A\u6709\u53D8\u5316" : "\u4ED3\u5E93\u6709\u53D8\u5316";
      const item = list.createEl("li");
      item.createEl("span", { text: `${file.path} \xB7 ${side}` });
      if (isMarkdownNote(file.path)) {
        const compare = item.createEl("button", { cls: "github-vault-sync-note-compare", text: "\u67E5\u770B\u4E24\u7AEF\u5185\u5BB9" });
        compare.type = "button";
        compare.addEventListener("click", () => void this.onCompareNote(file.path));
      }
    }
    if (files.length > 30) group.createEl("p", { text: `\u53E6\u6709 ${files.length - 30} \u4E2A\u6587\u4EF6\u672A\u5C55\u5F00\u2026`, cls: "setting-item-description" });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var NoteComparisonModal = class extends import_obsidian2.Modal {
  constructor(app, filePath, local, remote, remoteCommit, localModified, remoteModified) {
    super(app);
    this.filePath = filePath;
    this.local = local;
    this.remote = remote;
    this.remoteCommit = remoteCommit;
    this.localModified = localModified;
    this.remoteModified = remoteModified;
  }
  onOpen() {
    this.modalEl.addClass("github-vault-sync-note-wide-modal");
    this.contentEl.empty();
    this.contentEl.addClass("github-vault-sync-note-comparison");
    this.contentEl.createEl("h2", { text: this.filePath });
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "\u4EE5\u4E0B\u4E3A\u53EA\u8BFB\u9884\u89C8\uFF0C\u8D85\u8FC7 120,000 \u5B57\u7684\u5185\u5BB9\u4F1A\u622A\u65AD\u3002\u8BF7\u6309\u5185\u5BB9\u5224\u65AD\uFF0C\u4E0D\u8981\u4EC5\u4F9D\u8D56\u8BBE\u5907\u65F6\u95F4\u3002"
    });
    const columns = this.contentEl.createDiv({ cls: "github-vault-sync-note-columns" });
    const left = columns.createDiv();
    left.createEl("h3", { text: "\u672C\u8BBE\u5907" });
    left.createEl("small", { text: this.localModified, cls: "setting-item-description" });
    left.createEl("pre", { text: this.local });
    const right = columns.createDiv();
    right.createEl("h3", { text: `GitHub \u4ED3\u5E93 \xB7 ${this.remoteCommit}` });
    right.createEl("small", { text: this.remoteModified, cls: "setting-item-description" });
    right.createEl("pre", { text: this.remote });
    new import_obsidian2.Setting(this.contentEl).addButton((button) => button.setButtonText("\u8FD4\u56DE\u540C\u6B65\u9884\u89C8").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var SyncCenterModal = class extends import_obsidian2.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    this.render();
    this.unsubscribe = this.plugin.subscribeSnapshot((snapshot) => {
      var _a;
      (_a = this.statusEl) == null ? void 0 : _a.setText(snapshot.message);
      if (this.summaryEl) renderSyncSummary(this.summaryEl, snapshot);
      if (snapshot.phase === "waiting-conflicts") this.render();
    });
  }
  render() {
    var _a, _b;
    const { contentEl } = this;
    contentEl.empty();
    const snapshot = this.plugin.engine.getSnapshot();
    contentEl.createEl("h2", { text: "GitHub Vault Sync" });
    if (this.plugin.settings.repo) contentEl.createEl("p", { text: `\u4ED3\u5E93\uFF1A${this.plugin.settings.repo.owner}/${this.plugin.settings.repo.name} \xB7 \u5206\u652F\uFF1A${this.plugin.settings.branch}` });
    this.statusEl = contentEl.createEl("p", { cls: "setting-item-description", text: snapshot.message });
    this.summaryEl = contentEl.createDiv({ cls: "github-vault-sync-summary" });
    renderSyncSummary(this.summaryEl, snapshot);
    if (snapshot.error) contentEl.createEl("pre", { text: snapshot.error, cls: "github-vault-sync-error-text" });
    if (snapshot.warnings.length) {
      const list = contentEl.createEl("ul");
      for (const warning of snapshot.warnings.slice(0, 15)) list.createEl("li", { text: warning });
    }
    const actions = new import_obsidian2.Setting(contentEl);
    actions.addButton((button) => button.setButtonText("\u9884\u89C8\u5E76\u540C\u6B65").setCta().onClick(async () => {
      await this.plugin.syncNow();
      this.render();
    }));
    if (this.plugin.settings.encryptionKey) actions.addButton((button) => button.setButtonText("\u6062\u590D\u52A0\u5BC6\u914D\u7F6E").onClick(() => void this.plugin.restorePrivateSettings()));
    if (((_b = (_a = this.plugin.settings.pendingMerge) == null ? void 0 : _a.conflicts.length) != null ? _b : 0) > 0) actions.addButton((button) => button.setButtonText("\u5904\u7406\u51B2\u7A81").setWarning().onClick(() => this.plugin.openConflicts()));
    actions.addButton((button) => button.setButtonText("\u5173\u95ED").onClick(() => this.close()));
  }
  onClose() {
    var _a;
    (_a = this.unsubscribe) == null ? void 0 : _a.call(this);
    this.contentEl.empty();
  }
};
var ConflictModal = class extends import_obsidian2.Modal {
  constructor(app, conflicts, onSubmit) {
    super(app);
    this.conflicts = conflicts;
    this.onSubmit = onSubmit;
    this.choices = {};
    for (const conflict of conflicts) this.choices[conflict.path] = conflict.choice;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `\u540C\u6B65\u51B2\u7A81\uFF08${this.conflicts.length}\uFF09` });
    contentEl.createEl("p", { text: "GitHub Vault Sync \u4E0D\u81EA\u52A8\u5408\u5E76\u540C\u4E00\u8DEF\u5F84\u7684\u4E24\u4EFD\u4FEE\u6539\u3002\u8BF7\u9009\u62E9\u6BCF\u4E2A\u6587\u4EF6\u7684\u7248\u672C\u3002" });
    new import_obsidian2.Setting(contentEl).setName("\u6279\u91CF\u9ED8\u8BA4").addDropdown((dropdown) => dropdown.addOptions({ "": "\u4E0D\u6539\u53D8", local: "\u5168\u90E8\u4FDD\u7559\u672C\u5730", remote: "\u5168\u90E8\u4F7F\u7528\u8FDC\u7AEF", both: "\u5168\u90E8\u4FDD\u7559\u4E24\u4EFD" }).onChange((value) => {
      if (!value) return;
      for (const conflict of this.conflicts) this.choices[conflict.path] = value;
      this.renderChoices();
    }));
    this.choiceContainer = contentEl.createDiv({ cls: "github-vault-sync-conflicts" });
    this.renderChoices();
    new import_obsidian2.Setting(contentEl).addButton((button) => button.setButtonText("\u5E94\u7528\u9009\u62E9").setCta().onClick(() => void this.onSubmit(this.choices))).addButton((button) => button.setButtonText("\u53D6\u6D88").onClick(() => this.close()));
  }
  renderChoices() {
    var _a, _b;
    if (!this.choiceContainer) return;
    this.choiceContainer.empty();
    for (const conflict of this.conflicts) {
      const size = `\u672C\u5730 ${conflict.localExists ? formatBytes((_a = conflict.localSize) != null ? _a : 0) : "\u4E0D\u5B58\u5728"} \xB7 \u8FDC\u7AEF ${conflict.remoteExists ? formatBytes((_b = conflict.remoteSize) != null ? _b : 0) : "\u4E0D\u5B58\u5728"}`;
      new import_obsidian2.Setting(this.choiceContainer).setName(conflict.path).setDesc(size).addDropdown((dropdown) => {
        var _a2;
        return dropdown.addOptions({ "": "\u8BF7\u9009\u62E9", local: "\u4FDD\u7559\u672C\u5730", remote: "\u4F7F\u7528\u8FDC\u7AEF", both: "\u4FDD\u7559\u4E24\u4EFD" }).setValue((_a2 = this.choices[conflict.path]) != null ? _a2 : "").onChange((value) => {
          this.choices[conflict.path] = value;
        });
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var RecoveryKeyModal = class extends import_obsidian2.Modal {
  constructor(app, recoveryKey, recoveryFile) {
    super(app);
    this.recoveryKey = recoveryKey;
    this.recoveryFile = recoveryFile;
  }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("github-vault-sync-key-modal");
    this.contentEl.createEl("h2", { text: "\u6062\u590D\u5BC6\u94A5" });
    this.contentEl.createEl("p", { text: "\u4EC5\u5728\u6B64\u7A97\u53E3\u6253\u5F00\u65F6\u663E\u793A\u3002\u4EFB\u4F55\u62FF\u5230\u6B64\u5BC6\u94A5\u53CA\u4ED3\u5E93\u526F\u672C\u7684\u4EBA\u90FD\u53EF\u80FD\u89E3\u5BC6\u4F60\u7684\u63D2\u4EF6\u51ED\u636E\uFF1B\u8BF7\u52FF\u622A\u56FE\u5206\u4EAB\u3001\u7C98\u8D34\u5230\u7B14\u8BB0\u6216\u4E0A\u4F20\u81F3 GitHub\u3002" });
    const key = this.contentEl.createEl("code", { cls: "github-vault-sync-key-value", text: this.recoveryKey });
    key.setAttribute("aria-label", "\u4EC5\u5728\u672C\u673A\u663E\u793A\u7684\u6062\u590D\u5BC6\u94A5");
    this.contentEl.createEl("small", { text: `\u672C\u673A\u5907\u4EFD\u6587\u4EF6\uFF1A${this.recoveryFile}`, cls: "setting-item-description" });
    new import_obsidian2.Setting(this.contentEl).addButton((button) => button.setButtonText("\u590D\u5236\u5BC6\u94A5").setCta().onClick(async () => {
      let copied = false;
      try {
        await navigator.clipboard.writeText(this.recoveryKey);
        copied = true;
      } catch (e) {
        const field = document.createElement("textarea");
        field.value = this.recoveryKey;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        copied = document.execCommand("copy");
        field.remove();
      }
      new import_obsidian2.Notice(copied ? "\u6062\u590D\u5BC6\u94A5\u5DF2\u590D\u5236\uFF1B\u7C98\u8D34\u540E\u8BF7\u6CE8\u610F\u6E05\u7406\u526A\u8D34\u677F\u3002" : "\u81EA\u52A8\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u9009\u4E2D\u5BC6\u94A5\u6587\u672C\u624B\u52A8\u590D\u5236\u3002");
    })).addButton((button) => button.setButtonText("\u5173\u95ED\u5E76\u9690\u85CF").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
    this.recoveryKey = "";
  }
};
var DependencyModal = class extends import_obsidian2.Modal {
  constructor(app, status) {
    super(app);
    this.status = status;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Git \u4F9D\u8D56\u68C0\u6D4B" });
    contentEl.createEl("p", { text: `Git\uFF1A${this.status.git.available ? this.status.git.version : "\u672A\u5B89\u88C5"}${this.status.git.executable ? ` \xB7 ${this.status.git.executable}` : ""}` });
    contentEl.createEl("p", { text: `Git LFS\uFF1A${this.status.gitLfs.available ? this.status.gitLfs.version : "\u672A\u5B89\u88C5"}${this.status.gitLfs.available ? this.status.gitLfs.initialized ? " \xB7 \u5DF2\u521D\u59CB\u5316" : " \xB7 \u672A\u521D\u59CB\u5316" : ""}` });
    if (!this.status.git.available || !this.status.gitLfs.available) contentEl.createEl("p", { text: "\u8BF7\u5B89\u88C5 Git \u548C Git LFS \u540E\u91CD\u65B0\u68C0\u6D4B\u3002\u63D2\u4EF6\u4E0D\u4F1A\u9759\u9ED8\u6267\u884C\u7BA1\u7406\u5458\u5B89\u88C5\u3002", cls: "setting-item-description" });
    new import_obsidian2.Setting(contentEl).addButton((button) => button.setButtonText("\u5173\u95ED").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var TextModal = class extends import_obsidian2.Modal {
  constructor(app, title, value) {
    super(app);
    this.title = title;
    this.value = value;
  }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: this.title });
    this.contentEl.createEl("pre", { text: this.value || "\u6682\u65E0\u65E5\u5FD7" });
    new import_obsidian2.Setting(this.contentEl).addButton((button) => button.setButtonText("\u5173\u95ED").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ConfirmModal = class extends import_obsidian2.Modal {
  constructor(app, title, description, onConfirm) {
    super(app);
    this.title = title;
    this.description = description;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: this.title });
    this.contentEl.createEl("p", { text: this.description });
    new import_obsidian2.Setting(this.contentEl).addButton((button) => button.setButtonText("\u786E\u8BA4").setWarning().onClick(async () => {
      this.close();
      await this.onConfirm();
    })).addButton((button) => button.setButtonText("\u53D6\u6D88").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
};
