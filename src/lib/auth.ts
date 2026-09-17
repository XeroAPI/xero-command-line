import {chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {encrypt, decrypt, getOrCreateKey, CONFIG_DIR, EncryptionKeyError} from './crypto.js'
import {withFileLock, writeFileAtomic} from './atomic-file.js'

export interface TokenEntry {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in ms
  tenantId: string
  tenantName?: string
}

interface EncryptedTokenEntry {
  accessToken: string // encrypted
  refreshToken: string // encrypted
  expiresAt: number
  tenantId: string
  tenantName?: string
}

interface TokenCache {
  [profileName: string]: EncryptedTokenEntry
}

const TOKEN_PATH = join(CONFIG_DIR, 'tokens.json')
const TOKEN_BACKUP_PATH = `${TOKEN_PATH}.bak`
const TOKEN_LOCK_PATH = `${TOKEN_PATH}.lock`
const TOKEN_BUFFER_MS = 60_000 // Refresh 60s before expiry

/** The token cache file exists but cannot be read or parsed. Distinct from "not logged in". */
export class TokenCacheError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenCacheError'
  }
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, {recursive: true})
  }
}

/**
 * Read the token cache. A missing file is an empty cache. A file that exists but
 * cannot be read or parsed is an error — returning {} here would let the next
 * write replace every cached profile with a single entry.
 */
function readTokenCache(): TokenCache {
  ensureConfigDir()
  if (!existsSync(TOKEN_PATH)) {
    return {}
  }
  let raw: string
  try {
    raw = readFileSync(TOKEN_PATH, 'utf-8')
  } catch (error) {
    throw new TokenCacheError(
      `Could not read the token cache at ${TOKEN_PATH}: ${(error as Error).message}`,
    )
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not a JSON object')
    }
    return parsed as TokenCache
  } catch {
    throw new TokenCacheError(
      `The token cache at ${TOKEN_PATH} is corrupted. ` +
        `A backup of the previous version may exist at ${TOKEN_BACKUP_PATH}. ` +
        `Restore it over tokens.json, or move tokens.json aside and run "xero login" for each profile.`,
    )
  }
}

/**
 * Replace the token cache atomically, keeping a one-generation backup of the
 * previous contents so a bad write is recoverable without re-authenticating.
 */
function writeTokenCache(cache: TokenCache): void {
  ensureConfigDir()
  if (existsSync(TOKEN_PATH)) {
    copyFileSync(TOKEN_PATH, TOKEN_BACKUP_PATH)
    chmodSync(TOKEN_BACKUP_PATH, 0o600)
  }
  writeFileAtomic(TOKEN_PATH, JSON.stringify(cache, null, 2), 0o600)
}

export async function getCachedTokenSet(profileName: string): Promise<TokenEntry | null> {
  const cache = readTokenCache()
  const entry = cache[profileName]
  if (!entry) return null

  try {
    const key = await getOrCreateKey()
    return {
      accessToken: decrypt(entry.accessToken, key),
      refreshToken: decrypt(entry.refreshToken, key),
      expiresAt: entry.expiresAt,
      tenantId: entry.tenantId,
      tenantName: entry.tenantName,
    }
  } catch (error) {
    if (error instanceof EncryptionKeyError) throw error
    throw new EncryptionKeyError(
      'Could not decrypt cached tokens. Run "xero login" to re-authenticate.',
    )
  }
}

export function isTokenExpired(entry: TokenEntry): boolean {
  return Date.now() >= entry.expiresAt - TOKEN_BUFFER_MS
}

export async function cacheTokenSet(
  profileName: string,
  tokenSet: {access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number},
  tenantId: string,
  tenantName?: string,
): Promise<void> {
  const accessToken = tokenSet.access_token
  const refreshToken = tokenSet.refresh_token
  if (!accessToken || !refreshToken) return

  let expiresAt: number
  if (tokenSet.expires_at) {
    // expires_at is in seconds since epoch
    expiresAt = tokenSet.expires_at * 1000
  } else if (tokenSet.expires_in) {
    expiresAt = Date.now() + tokenSet.expires_in * 1000
  } else {
    // Default 30 min
    expiresAt = Date.now() + 1800 * 1000
  }

  // Key lookup may hit the OS keychain and be slow; keep it outside the lock.
  const key = await getOrCreateKey()
  const entry: EncryptedTokenEntry = {
    accessToken: encrypt(accessToken, key),
    refreshToken: encrypt(refreshToken, key),
    expiresAt,
    tenantId,
    tenantName,
  }

  ensureConfigDir()
  await withFileLock(TOKEN_LOCK_PATH, () => {
    const cache = readTokenCache()
    cache[profileName] = entry
    writeTokenCache(cache)
  })
}

export async function clearCachedToken(profileName: string): Promise<void> {
  ensureConfigDir()
  await withFileLock(TOKEN_LOCK_PATH, () => {
    const cache = readTokenCache()
    if (!(profileName in cache)) return
    delete cache[profileName]
    writeTokenCache(cache)
  })
}
