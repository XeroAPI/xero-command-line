import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {spawn} from 'node:child_process'
import {mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {randomBytes} from 'node:crypto'
import {fileURLToPath} from 'node:url'

/**
 * Reproduces the customer report: several processes doing read-modify-write on
 * tokens.json at the same time. Before the fix this destroyed every profile
 * except the one being written. The worker runs the real auth module in a
 * separate Node process, with HOME pointed at a temp dir and a pre-seeded file
 * key so the OS keychain is never touched.
 */

const TEST_DIR = join(tmpdir(), `xero-auth-concurrency-test-${Date.now()}`)
const CONFIG_DIR = join(TEST_DIR, '.config', 'xero-command-line')
const TOKEN_PATH = join(CONFIG_DIR, 'tokens.json')
const KEY = randomBytes(32)
const WORKERS = 8
const ITERATIONS = 20
const PRESEEDED = ['existing-1', 'existing-2', 'existing-3']

const here = dirname(fileURLToPath(import.meta.url))
const WORKER = join(here, '..', 'helpers', 'token-cache-worker.ts')

function runWorker(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--loader', 'ts-node/esm', '--no-warnings', WORKER, name, String(ITERATIONS)], {
      env: {
        ...process.env,
        HOME: TEST_DIR,
        USERPROFILE: TEST_DIR,
        XERO_KEY_STORAGE: 'file',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', chunk => (stderr += chunk))
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`worker ${name} exited with ${code}\n${stderr}`))
    })
  })
}

describe('token cache under concurrent writers', () => {
  beforeAll(() => {
    mkdirSync(CONFIG_DIR, {recursive: true})
    writeFileSync(join(CONFIG_DIR, '.encryption-key'), KEY.toString('base64'), {mode: 0o600})
    const seed: Record<string, unknown> = {}
    for (const name of PRESEEDED) {
      seed[name] = {accessToken: 'enc', refreshToken: 'enc', expiresAt: 1, tenantId: `tenant-${name}`}
    }
    writeFileSync(TOKEN_PATH, JSON.stringify(seed, null, 2), {mode: 0o600})
  })

  afterAll(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  it(
    'never loses a profile when many processes write at once',
    async () => {
      const names = Array.from({length: WORKERS}, (_, i) => `worker-${i}`)
      await Promise.all(names.map(runWorker))

      const cache = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as Record<string, {accessToken: string}>
      const keys = Object.keys(cache).sort()
      expect(keys).toEqual([...PRESEEDED, ...names].sort())

      const leftovers = readdirSync(CONFIG_DIR).filter(f => f.endsWith('.tmp') || f.endsWith('.lock'))
      expect(leftovers).toEqual([])
    },
    60_000,
  )
})
