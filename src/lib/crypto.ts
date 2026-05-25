import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto'
import {chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEYRING_SERVICE = 'xero-command-line'
const KEYRING_ACCOUNT = 'encryption-key'

export const CONFIG_DIR = join(homedir(), '.config', 'xero-command-line')
const FILE_KEY_PATH = join(CONFIG_DIR, '.encryption-key')
const PASSPHRASE_SALT_PATH = join(CONFIG_DIR, '.encryption-key.salt')

/** Derive the encryption key from a user-supplied passphrase (stronger file-based fallback). */
export const PASSPHRASE_ENV = 'XERO_TOKEN_PASSPHRASE'

/**
 * Mirror the encryption key to ~/.config/xero-command-line/.encryption-key when the
 * OS keychain accepts a write. Opt-in — see FILE_BACKUP_ENV. Off by default.
 */
export const FILE_BACKUP_ENV = 'XERO_KEYRING_FILE_BACKUP'

/**
 * Control where the encryption key is stored.
 * - auto (default): OS keychain only; optional file backup via FILE_BACKUP_ENV
 * - keyring: OS keychain only
 * - file: ~/.config/xero-command-line/.encryption-key only
 */
export const KEY_STORAGE_ENV = 'XERO_KEY_STORAGE'

export type KeyStorageMode = 'auto' | 'keyring' | 'file'

export class EncryptionKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncryptionKeyError'
  }
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, {recursive: true})
  }
}

function writeSecretFile(path: string, contents: string): void {
  ensureConfigDir()
  writeFileSync(path, contents, {mode: 0o600})
  chmodSync(path, 0o600)
}

export function resolveKeyStorageMode(): KeyStorageMode {
  const value = process.env[KEY_STORAGE_ENV]?.toLowerCase()
  if (value === 'keyring' || value === 'file') return value
  return 'auto'
}

export function isFileBackupEnabled(): boolean {
  const value = process.env[FILE_BACKUP_ENV]?.toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

export function hasEncryptedTokens(): boolean {
  const tokenPath = join(CONFIG_DIR, 'tokens.json')
  if (!existsSync(tokenPath)) return false
  try {
    const cache = JSON.parse(readFileSync(tokenPath, 'utf-8')) as Record<string, unknown>
    return Object.keys(cache).length > 0
  } catch {
    return false
  }
}

/**
 * Get or create the AES-256 encryption key.
 * Priority: passphrase (env) → OS keychain → optional file backup → create new (keyring and/or file).
 */
export async function getOrCreateKey(): Promise<Buffer> {
  const passphrase = process.env[PASSPHRASE_ENV]
  if (passphrase) {
    return getOrCreatePassphraseKey(passphrase)
  }

  const mode = resolveKeyStorageMode()
  const existing = await loadStoredKey(mode)
  if (existing) return existing

  if (hasEncryptedTokens()) {
    throw new EncryptionKeyError(
      'Could not read the encryption key for cached tokens. On Linux/WSL/SSH this usually means the secret service (e.g. GNOME Keyring) is unavailable in this session. Install and start gnome-keyring, set XERO_KEYRING_FILE_BACKUP=1 (if the keychain is flaky), XERO_KEY_STORAGE=file, or XERO_TOKEN_PASSPHRASE and run "xero login" again. See README: Token storage.',
    )
  }

  const key = randomBytes(32)
  await persistNewKey(key, mode)
  return key
}

/**
 * Delete stored encryption keys (keyring + file + passphrase salt).
 */
export async function deleteKey(): Promise<void> {
  await tryKeyringDelete()
  if (existsSync(FILE_KEY_PATH)) {
    writeFileSync(FILE_KEY_PATH, '', {mode: 0o600})
  }
  if (existsSync(PASSPHRASE_SALT_PATH)) {
    writeFileSync(PASSPHRASE_SALT_PATH, '', {mode: 0o600})
  }
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {authTagLength: AUTH_TAG_LENGTH})

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString('base64')
}

export function decrypt(encoded: string, key: Buffer): string {
  const packed = Buffer.from(encoded, 'base64')

  const iv = packed.subarray(0, IV_LENGTH)
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv, {authTagLength: AUTH_TAG_LENGTH})
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf-8')
}

function getOrCreatePassphraseKey(passphrase: string): Buffer {
  ensureConfigDir()
  let salt: Buffer
  if (existsSync(PASSPHRASE_SALT_PATH)) {
    salt = Buffer.from(readFileSync(PASSPHRASE_SALT_PATH, 'utf-8').trim(), 'base64')
  } else {
    if (hasEncryptedTokens()) {
      throw new EncryptionKeyError(
        `Cached tokens were encrypted without ${PASSPHRASE_ENV}. Run "xero login" after setting the same passphrase, or clear tokens and log in again.`,
      )
    }
    salt = randomBytes(16)
    writeSecretFile(PASSPHRASE_SALT_PATH, salt.toString('base64'))
  }
  return scryptSync(passphrase, salt, 32)
}

async function loadStoredKey(mode: KeyStorageMode): Promise<Buffer | null> {
  if (mode === 'file') {
    return readFileKey()
  }

  const fromKeyring = await tryKeyringGet()
  if (fromKeyring) return Buffer.from(fromKeyring, 'base64')

  if (mode === 'keyring' || !isFileBackupEnabled()) return null

  // auto + opt-in backup: read file when keychain read fails (common on WSL/SSH)
  return readFileKey()
}

async function persistNewKey(key: Buffer, mode: KeyStorageMode): Promise<void> {
  const encoded = key.toString('base64')
  const keyringOk = mode !== 'file' && (await tryKeyringSet(encoded))

  let fileOk = false
  if (mode === 'file') {
    fileOk = writeFileKey(encoded)
  } else if (!keyringOk) {
    // Keychain unavailable — persist to file so login can succeed in auto mode
    fileOk = writeFileKey(encoded)
  }

  if (keyringOk || fileOk) return

  throw new EncryptionKeyError(
    'Could not store the encryption key. On Linux/WSL install gnome-keyring and libsecret, or set XERO_KEY_STORAGE=file, XERO_KEYRING_FILE_BACKUP=1, or XERO_TOKEN_PASSPHRASE. See README: Token storage.',
  )
}

function readFileKey(): Buffer | null {
  if (!existsSync(FILE_KEY_PATH)) return null
  try {
    const raw = readFileSync(FILE_KEY_PATH, 'utf-8').trim()
    if (!raw) return null
    return Buffer.from(raw, 'base64')
  } catch {
    return null
  }
}

function writeFileKey(encoded: string): boolean {
  try {
    writeSecretFile(FILE_KEY_PATH, encoded)
    return true
  } catch {
    return false
  }
}

async function tryKeyringGet(): Promise<string | null> {
  try {
    const {Entry} = await import('@napi-rs/keyring')
    const entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
    return entry.getPassword()
  } catch {
    return null
  }
}

async function tryKeyringSet(value: string): Promise<boolean> {
  try {
    const {Entry} = await import('@napi-rs/keyring')
    const entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
    entry.setPassword(value)
    if (resolveKeyStorageMode() === 'auto' && isFileBackupEnabled()) {
      writeFileKey(value)
    }
    return true
  } catch {
    return false
  }
}

async function tryKeyringDelete(): Promise<void> {
  try {
    const {Entry} = await import('@napi-rs/keyring')
    const entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
    entry.deletePassword()
  } catch {
    // Keyring unavailable or key doesn't exist
  }
}
