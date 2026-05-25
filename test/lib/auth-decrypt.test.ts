import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomBytes} from 'node:crypto'

const TEST_DIR = join(tmpdir(), `xero-auth-decrypt-test-${Date.now()}`)
const TEST_KEY = randomBytes(32)
const WRONG_KEY = randomBytes(32)

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

let useWrongKey = false

vi.mock('../../src/lib/crypto.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/crypto.js')>('../../src/lib/crypto.js')
  return {
    ...actual,
    CONFIG_DIR: join(TEST_DIR, '.config', 'xero-command-line'),
    getOrCreateKey: async () => (useWrongKey ? WRONG_KEY : TEST_KEY),
    encrypt: (plaintext: string, key: Buffer) => actual.encrypt(plaintext, key),
    decrypt: (encoded: string, key: Buffer) => actual.decrypt(encoded, key),
  }
})

const CONFIG_DIR = join(TEST_DIR, '.config', 'xero-command-line')
const TOKEN_PATH = join(CONFIG_DIR, 'tokens.json')

const {cacheTokenSet, getCachedTokenSet} = await import('../../src/lib/auth.js')
const {EncryptionKeyError} = await import('../../src/lib/crypto.js')

describe('auth decrypt failures', () => {
  beforeEach(() => {
    useWrongKey = false
    mkdirSync(CONFIG_DIR, {recursive: true})
  })

  afterEach(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  it('does not delete tokens when decryption fails', async () => {
    await cacheTokenSet('regan', {access_token: 'tok', refresh_token: 'ref', expires_in: 1800}, 'tenant-1')
    useWrongKey = true

    await expect(getCachedTokenSet('regan')).rejects.toBeInstanceOf(EncryptionKeyError)

    const cache = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as Record<string, unknown>
    expect(cache.regan).toBeDefined()
  })
})
