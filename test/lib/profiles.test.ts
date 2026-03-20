import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {existsSync, mkdirSync, rmSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

// We need to mock the config directory before importing the module
const TEST_DIR = join(tmpdir(), `xero-cli-test-${Date.now()}`)

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

// Dynamic import after mocks are set up
const {addProfile, removeProfile, listProfiles, setDefaultProfile, getDefaultProfile, getProfileCredentials, profileExists} = await import('../../src/lib/profiles.js')

describe('profiles', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.config', 'xero-cli'), {recursive: true})
  })

  afterEach(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  describe('addProfile', () => {
    it('creates a new profile', async () => {
      await addProfile('test-profile', 'client-id-123', 'client-secret-456')

      const configPath = join(TEST_DIR, '.config', 'xero-cli', 'config.json')
      expect(existsSync(configPath)).toBe(true)

      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      expect(config.profiles['test-profile']).toBeDefined()
      expect(config.profiles['test-profile'].clientId).toBe('client-id-123')
    })

    it('sets first profile as default', async () => {
      await addProfile('first-profile', 'id-1', 'secret-1')
      expect(getDefaultProfile()).toBe('first-profile')
    })

    it('does not change default when adding more profiles', async () => {
      await addProfile('first', 'id-1', 'secret-1')
      await addProfile('second', 'id-2', 'secret-2')
      expect(getDefaultProfile()).toBe('first')
    })
  })

  describe('listProfiles', () => {
    it('returns empty list when no profiles', () => {
      const {profiles} = listProfiles()
      expect(profiles).toHaveLength(0)
    })

    it('returns all profiles', async () => {
      await addProfile('alpha', 'id-a', 'secret-a')
      await addProfile('beta', 'id-b', 'secret-b')

      const {profiles, defaultProfile} = listProfiles()
      expect(profiles).toHaveLength(2)
      expect(defaultProfile).toBe('alpha')
    })
  })

  describe('removeProfile', () => {
    it('removes a profile', async () => {
      await addProfile('to-remove', 'id-1', 'secret-1')
      expect(profileExists('to-remove')).toBe(true)

      await removeProfile('to-remove')
      expect(profileExists('to-remove')).toBe(false)
    })

    it('updates default when removing default profile', async () => {
      await addProfile('first', 'id-1', 'secret-1')
      await addProfile('second', 'id-2', 'secret-2')

      await removeProfile('first')
      expect(getDefaultProfile()).toBe('second')
    })
  })

  describe('setDefaultProfile', () => {
    it('sets the default profile', async () => {
      await addProfile('alpha', 'id-a', 'secret-a')
      await addProfile('beta', 'id-b', 'secret-b')

      setDefaultProfile('beta')
      expect(getDefaultProfile()).toBe('beta')
    })

    it('throws for non-existent profile', () => {
      expect(() => setDefaultProfile('nonexistent')).toThrow()
    })
  })

  describe('getProfileCredentials', () => {
    it('returns credentials from file fallback', async () => {
      await addProfile('test', 'my-client-id', 'my-client-secret')

      const creds = await getProfileCredentials('test')
      expect(creds.clientId).toBe('my-client-id')
      expect(creds.clientSecret).toBe('my-client-secret')
    })

    it('throws for non-existent profile', async () => {
      await expect(getProfileCredentials('missing')).rejects.toThrow()
    })
  })

  describe('profileExists', () => {
    it('returns false for non-existent profile', () => {
      expect(profileExists('missing')).toBe(false)
    })

    it('returns true for existing profile', async () => {
      await addProfile('existing', 'id', 'secret')
      expect(profileExists('existing')).toBe(true)
    })
  })
})
