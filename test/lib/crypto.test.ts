import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdirSync, rmSync, readFileSync, existsSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

const TEST_DIR = join(tmpdir(), `xero-crypto-test-${Date.now()}`)

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

vi.mock('@napi-rs/keyring', () => ({
  Entry: class MockEntry {
    static store: string | null = null
    constructor(_service: string, _account: string) {}
    getPassword() {
      return MockEntry.store
    }
    setPassword(value: string) {
      MockEntry.store = value
    }
    deletePassword() {
      MockEntry.store = null
    }
  },
}))

const {
  getOrCreateKey,
  encrypt,
  decrypt,
  hasEncryptedTokens,
  EncryptionKeyError,
  CONFIG_DIR,
  PASSPHRASE_ENV,
  KEY_STORAGE_ENV,
  FILE_BACKUP_ENV,
} = await import('../../src/lib/crypto.js')

const FILE_KEY_PATH = join(CONFIG_DIR, '.encryption-key')
const TOKEN_PATH = join(CONFIG_DIR, 'tokens.json')

describe('crypto key storage', () => {
  beforeEach(async () => {
    delete process.env[PASSPHRASE_ENV]
    delete process.env[KEY_STORAGE_ENV]
    delete process.env[FILE_BACKUP_ENV]
    mkdirSync(CONFIG_DIR, {recursive: true})
    const {Entry} = await import('@napi-rs/keyring')
    Entry.store = null
  })

  afterEach(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  it('stores key in keyring only by default (no file backup)', async () => {
    const key = await getOrCreateKey()
    expect(existsSync(FILE_KEY_PATH)).toBe(false)
    const {Entry} = await import('@napi-rs/keyring')
    expect(Entry.store).toBe(key.toString('base64'))
    const roundTrip = encrypt('secret', key)
    expect(decrypt(roundTrip, key)).toBe('secret')
  })

  it('writes file backup when XERO_KEYRING_FILE_BACKUP is enabled', async () => {
    process.env[FILE_BACKUP_ENV] = '1'
    await getOrCreateKey()
    expect(existsSync(FILE_KEY_PATH)).toBe(true)
    const {Entry} = await import('@napi-rs/keyring')
    expect(Entry.store).not.toBeNull()
  })

  it('reads file backup when keyring is empty and backup is enabled', async () => {
    process.env[FILE_BACKUP_ENV] = '1'
    const first = await getOrCreateKey()
    const {Entry} = await import('@napi-rs/keyring')
    Entry.store = null
    const second = await getOrCreateKey()
    expect(second.equals(first)).toBe(true)
  })

  it('does not read file backup when backup is disabled', async () => {
    process.env[FILE_BACKUP_ENV] = '1'
    await getOrCreateKey()
    const {Entry} = await import('@napi-rs/keyring')
    Entry.store = null
    delete process.env[FILE_BACKUP_ENV]
    writeFileSync(TOKEN_PATH, JSON.stringify({regan: {accessToken: 'x', refreshToken: 'y', expiresAt: 0, tenantId: 't'}}), {
      mode: 0o600,
    })
    await expect(getOrCreateKey()).rejects.toBeInstanceOf(EncryptionKeyError)
  })

  it('throws instead of creating a new key when tokens exist but no key is found', async () => {
    writeFileSync(TOKEN_PATH, JSON.stringify({regan: {accessToken: 'x', refreshToken: 'y', expiresAt: 0, tenantId: 't'}}), {
      mode: 0o600,
    })
    const {Entry} = await import('@napi-rs/keyring')
    Entry.store = null
    rmSync(FILE_KEY_PATH, {force: true})
    await expect(getOrCreateKey()).rejects.toBeInstanceOf(EncryptionKeyError)
    expect(hasEncryptedTokens()).toBe(true)
  })

  it('derives a stable key from XERO_TOKEN_PASSPHRASE', async () => {
    process.env[PASSPHRASE_ENV] = 'test-passphrase'
    const a = await getOrCreateKey()
    const b = await getOrCreateKey()
    expect(a.equals(b)).toBe(true)
    expect(existsSync(join(CONFIG_DIR, '.encryption-key.salt'))).toBe(true)
  })

  it('uses file-only storage when XERO_KEY_STORAGE=file', async () => {
    process.env[KEY_STORAGE_ENV] = 'file'
    await getOrCreateKey()
    const {Entry} = await import('@napi-rs/keyring')
    expect(Entry.store).toBeNull()
    expect(readFileSync(FILE_KEY_PATH, 'utf-8').length).toBeGreaterThan(0)
  })
})
