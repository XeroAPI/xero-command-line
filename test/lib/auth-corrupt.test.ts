import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomBytes} from 'node:crypto'

const TEST_DIR = join(tmpdir(), `xero-auth-corrupt-test-${Date.now()}`)
const TEST_KEY = randomBytes(32)

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

vi.mock('../../src/lib/crypto.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/crypto.js')>('../../src/lib/crypto.js')
  return {
    ...actual,
    CONFIG_DIR: join(TEST_DIR, '.config', 'xero-command-line'),
    getOrCreateKey: async () => TEST_KEY,
  }
})

const CONFIG_DIR = join(TEST_DIR, '.config', 'xero-command-line')
const TOKEN_PATH = join(CONFIG_DIR, 'tokens.json')

const {cacheTokenSet, getCachedTokenSet, clearCachedToken, TokenCacheError} = await import('../../src/lib/auth.js')

describe('corrupt token cache', () => {
  beforeEach(() => {
    mkdirSync(CONFIG_DIR, {recursive: true})
  })

  afterEach(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  it('returns null when the cache file is absent', async () => {
    expect(await getCachedTokenSet('anyone')).toBeNull()
  })

  it('throws TokenCacheError on read instead of treating a corrupt file as empty', async () => {
    const garbage = '{"regan": {"accessToken": "abc", "refreshTok'
    writeFileSync(TOKEN_PATH, garbage, {mode: 0o600})

    await expect(getCachedTokenSet('regan')).rejects.toBeInstanceOf(TokenCacheError)
    await expect(getCachedTokenSet('regan')).rejects.toThrow(/corrupted/)
    expect(readFileSync(TOKEN_PATH, 'utf-8')).toBe(garbage)
  })

  it('refuses to write over a corrupt cache', async () => {
    const garbage = 'not json at all'
    writeFileSync(TOKEN_PATH, garbage, {mode: 0o600})

    await expect(
      cacheTokenSet('new-profile', {access_token: 'a', refresh_token: 'r', expires_in: 1800}, 'tenant-1'),
    ).rejects.toBeInstanceOf(TokenCacheError)
    await expect(clearCachedToken('anything')).rejects.toBeInstanceOf(TokenCacheError)
    expect(readFileSync(TOKEN_PATH, 'utf-8')).toBe(garbage)
  })

  it('rejects a cache that parses but is not an object', async () => {
    writeFileSync(TOKEN_PATH, '[]', {mode: 0o600})
    await expect(getCachedTokenSet('regan')).rejects.toBeInstanceOf(TokenCacheError)
  })
})
