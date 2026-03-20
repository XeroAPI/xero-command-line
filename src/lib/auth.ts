import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {encrypt, decrypt, getOrCreateKey} from './crypto.js'

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

const CONFIG_DIR = join(homedir(), '.config', 'xero-cli')
const TOKEN_PATH = join(CONFIG_DIR, 'tokens.json')
const TOKEN_BUFFER_MS = 60_000 // Refresh 60s before expiry

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, {recursive: true})
  }
}

function readTokenCache(): TokenCache {
  ensureConfigDir()
  if (!existsSync(TOKEN_PATH)) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as TokenCache
  } catch {
    return {}
  }
}

function writeTokenCache(cache: TokenCache): void {
  ensureConfigDir()
  writeFileSync(TOKEN_PATH, JSON.stringify(cache, null, 2), {mode: 0o600})
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
  } catch {
    // Decryption failed (key rotated, corrupted data) — clear entry
    delete cache[profileName]
    writeTokenCache(cache)
    return null
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

  const key = await getOrCreateKey()
  const cache = readTokenCache()
  cache[profileName] = {
    accessToken: encrypt(accessToken, key),
    refreshToken: encrypt(refreshToken, key),
    expiresAt,
    tenantId,
    tenantName,
  }
  writeTokenCache(cache)
}

export function clearCachedToken(profileName: string): void {
  const cache = readTokenCache()
  delete cache[profileName]
  writeTokenCache(cache)
}
