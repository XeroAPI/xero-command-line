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
const {addProfile, removeProfile, listProfiles, setDefaultProfile, getDefaultProfile, getProfileClientId, profileExists} = await import('../../src/lib/profiles.js')

describe('profiles', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.config', 'xero-cli'), {recursive: true})
  })

  afterEach(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  describe('addProfile', () => {
    it('creates a new profile', () => {
      addProfile('test-profile', 'client-id-123')

      const configPath = join(TEST_DIR, '.config', 'xero-cli', 'config.json')
      expect(existsSync(configPath)).toBe(true)

      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      expect(config.profiles['test-profile']).toBeDefined()
      expect(config.profiles['test-profile'].clientId).toBe('client-id-123')
    })

    it('sets first profile as default', () => {
      addProfile('first-profile', 'id-1')
      expect(getDefaultProfile()).toBe('first-profile')
    })

    it('does not change default when adding more profiles', () => {
      addProfile('first', 'id-1')
      addProfile('second', 'id-2')
      expect(getDefaultProfile()).toBe('first')
    })
  })

  describe('listProfiles', () => {
    it('returns empty list when no profiles', () => {
      const {profiles} = listProfiles()
      expect(profiles).toHaveLength(0)
    })

    it('returns all profiles', () => {
      addProfile('alpha', 'id-a')
      addProfile('beta', 'id-b')

      const {profiles, defaultProfile} = listProfiles()
      expect(profiles).toHaveLength(2)
      expect(defaultProfile).toBe('alpha')
    })
  })

  describe('removeProfile', () => {
    it('removes a profile', () => {
      addProfile('to-remove', 'id-1')
      expect(profileExists('to-remove')).toBe(true)

      removeProfile('to-remove')
      expect(profileExists('to-remove')).toBe(false)
    })

    it('updates default when removing default profile', () => {
      addProfile('first', 'id-1')
      addProfile('second', 'id-2')

      removeProfile('first')
      expect(getDefaultProfile()).toBe('second')
    })
  })

  describe('setDefaultProfile', () => {
    it('sets the default profile', () => {
      addProfile('alpha', 'id-a')
      addProfile('beta', 'id-b')

      setDefaultProfile('beta')
      expect(getDefaultProfile()).toBe('beta')
    })

    it('throws for non-existent profile', () => {
      expect(() => setDefaultProfile('nonexistent')).toThrow()
    })
  })

  describe('getProfileClientId', () => {
    it('returns client ID for existing profile', () => {
      addProfile('test', 'my-client-id')
      expect(getProfileClientId('test')).toBe('my-client-id')
    })

    it('throws for non-existent profile', () => {
      expect(() => getProfileClientId('missing')).toThrow()
    })
  })

  describe('profileExists', () => {
    it('returns false for non-existent profile', () => {
      expect(profileExists('missing')).toBe(false)
    })

    it('returns true for existing profile', () => {
      addProfile('existing', 'id')
      expect(profileExists('existing')).toBe(true)
    })
  })
})
