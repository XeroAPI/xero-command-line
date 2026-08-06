import {beforeEach, describe, expect, it, vi} from 'vitest'
import {getInlineCredentialCacheKey, LEGACY_INLINE_CACHE_KEY} from '../../src/lib/credential-cache-key.js'

const mocks = vi.hoisted(() => ({
  addProfile: vi.fn(),
  cacheTokenSet: vi.fn(),
  clearCachedToken: vi.fn(),
  getDefaultProfile: vi.fn(),
  getProfileClientId: vi.fn(),
  performLogin: vi.fn(),
  profileExists: vi.fn(),
  removeProfile: vi.fn(),
}))

vi.mock('../../src/lib/auth.js', () => ({
  cacheTokenSet: mocks.cacheTokenSet,
  clearCachedToken: mocks.clearCachedToken,
}))

vi.mock('../../src/lib/profiles.js', () => ({
  addProfile: mocks.addProfile,
  getDefaultProfile: mocks.getDefaultProfile,
  getProfileClientId: mocks.getProfileClientId,
  profileExists: mocks.profileExists,
  removeProfile: mocks.removeProfile,
}))

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}))

vi.mock('../../src/lib/oauth.js', () => ({
  performLogin: mocks.performLogin,
}))

const {BaseCommand} = await import('../../src/base-command.js')
const {default: Login} = await import('../../src/commands/login.js')
const {default: Logout} = await import('../../src/commands/logout.js')
const {default: ProfileAdd} = await import('../../src/commands/profile/add.js')
const {default: ProfileRemove} = await import('../../src/commands/profile/remove.js')

function createCommand<T extends {prototype: object}>(
  CommandClass: T,
  parsed: {args?: Record<string, string>; flags?: Record<string, unknown>},
): {run: () => Promise<void>; log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>} {
  const command = Object.create(CommandClass.prototype) as {
    parse: ReturnType<typeof vi.fn>
    run: () => Promise<void>
    log: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }
  command.parse = vi.fn().mockResolvedValue(parsed)
  command.log = vi.fn()
  command.error = vi.fn((message: string) => {
    throw new Error(message)
  })
  return command
}

describe('OAuth cache lifecycle commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDefaultProfile.mockReturnValue(undefined)
  })

  it('uses a client-ID-scoped cache key for inline commands', () => {
    const command = Object.create(BaseCommand.prototype) as {
      resolveCredentials: (flags: {profile?: string; 'client-id'?: string}) => {profileName: string; clientId: string}
      error: (message: string) => never
    }
    command.error = (message: string): never => {
      throw new Error(message)
    }

    expect(command.resolveCredentials({'client-id': 'client-a'})).toEqual({
      profileName: getInlineCredentialCacheKey('client-a'),
      clientId: 'client-a',
    })
    expect(command.resolveCredentials({'client-id': 'client-b'})).toEqual({
      profileName: getInlineCredentialCacheKey('client-b'),
      clientId: 'client-b',
    })
  })

  it('keeps a named profile as the cache key when its client ID is overridden', () => {
    const command = Object.create(BaseCommand.prototype) as {
      resolveCredentials: (flags: {profile?: string; 'client-id'?: string}) => {profileName: string; clientId: string}
      error: (message: string) => never
    }
    command.error = (message: string): never => {
      throw new Error(message)
    }

    expect(command.resolveCredentials({profile: 'acme', 'client-id': 'alternate-client'})).toEqual({
      profileName: 'acme',
      clientId: 'alternate-client',
    })
  })

  it('keeps default-profile resolution unchanged when no client ID is supplied', () => {
    mocks.getDefaultProfile.mockReturnValue('default-profile')
    mocks.getProfileClientId.mockReturnValue('default-client')
    const command = Object.create(BaseCommand.prototype) as {
      resolveCredentials: (flags: {profile?: string; 'client-id'?: string}) => {profileName: string; clientId: string}
      error: (message: string) => never
    }
    command.error = (message: string): never => {
      throw new Error(message)
    }

    expect(command.resolveCredentials({})).toEqual({
      profileName: 'default-profile',
      clientId: 'default-client',
    })
  })

  it('stores each inline login under its client-ID-scoped key', async () => {
    mocks.performLogin
      .mockResolvedValueOnce({
        tokenSet: {access_token: 'token-a', refresh_token: 'refresh-a'},
        tenantId: 'tenant-a',
        tenantName: 'Tenant A',
      })
      .mockResolvedValueOnce({
        tokenSet: {access_token: 'token-b', refresh_token: 'refresh-b'},
        tenantId: 'tenant-b',
        tenantName: 'Tenant B',
      })

    await createCommand(Login, {flags: {'client-id': 'client-a'}}).run()
    await createCommand(Login, {flags: {'client-id': 'client-b'}}).run()

    expect(mocks.cacheTokenSet).toHaveBeenNthCalledWith(
      1,
      getInlineCredentialCacheKey('client-a'),
      expect.objectContaining({access_token: 'token-a'}),
      'tenant-a',
      'Tenant A',
    )
    expect(mocks.cacheTokenSet).toHaveBeenNthCalledWith(
      2,
      getInlineCredentialCacheKey('client-b'),
      expect.objectContaining({access_token: 'token-b'}),
      'tenant-b',
      'Tenant B',
    )
  })

  it('logs out a scoped inline session and purges the ambiguous legacy key', async () => {
    expect(Logout.flags['client-id']).toBeDefined()
    const command = createCommand(Logout, {flags: {'client-id': 'client-a'}})

    await command.run()

    expect(mocks.clearCachedToken).toHaveBeenNthCalledWith(1, getInlineCredentialCacheKey('client-a'))
    expect(mocks.clearCachedToken).toHaveBeenNthCalledWith(2, LEGACY_INLINE_CACHE_KEY)
    expect(command.log).toHaveBeenCalledWith(
      'Logged out from inline client credentials. Run "xero login" to re-authenticate.',
    )
  })

  it('continues to log out the default profile when no selector is supplied', async () => {
    mocks.getDefaultProfile.mockReturnValue('default-profile')
    const command = createCommand(Logout, {flags: {}})

    await command.run()

    expect(mocks.clearCachedToken).toHaveBeenCalledTimes(1)
    expect(mocks.clearCachedToken).toHaveBeenCalledWith('default-profile')
    expect(command.log).toHaveBeenCalledWith(
      'Logged out from profile "default-profile". Run "xero login" to re-authenticate.',
    )
  })

  it('clears cached credentials before removing a named profile', async () => {
    mocks.profileExists.mockReturnValue(true)
    const command = createCommand(ProfileRemove, {args: {name: 'acme'}})

    await command.run()

    expect(mocks.clearCachedToken).toHaveBeenCalledWith('acme')
    expect(mocks.removeProfile).toHaveBeenCalledWith('acme')
    expect(mocks.clearCachedToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeProfile.mock.invocationCallOrder[0],
    )
  })

  it('clears stale credentials when --force replaces a profile', async () => {
    mocks.profileExists.mockReturnValue(true)
    const command = createCommand(ProfileAdd, {
      args: {name: 'acme'},
      flags: {force: true, 'client-id': 'replacement-client'},
    })

    await command.run()

    expect(mocks.clearCachedToken).toHaveBeenCalledWith('acme')
    expect(mocks.addProfile).toHaveBeenCalledWith('acme', 'replacement-client')
    expect(mocks.clearCachedToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.addProfile.mock.invocationCallOrder[0],
    )
  })
})
