import {beforeEach, describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheTokenSet: vi.fn(),
  clearCachedToken: vi.fn(),
  getCachedTokenSet: vi.fn(),
  getClientHeaders: vi.fn(),
  isInvalidRefreshTokenError: vi.fn(),
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

class MockEncryptionKeyError extends Error {}

vi.mock('../../src/lib/auth.js', () => ({
  cacheTokenSet: mocks.cacheTokenSet,
  clearCachedToken: mocks.clearCachedToken,
  getCachedTokenSet: mocks.getCachedTokenSet,
  isTokenExpired: mocks.isTokenExpired,
}))

vi.mock('../../src/lib/crypto.js', () => ({
  EncryptionKeyError: MockEncryptionKeyError,
}))

vi.mock('../../src/lib/oauth.js', () => ({
  isInvalidRefreshTokenError: mocks.isInvalidRefreshTokenError,
  refreshAccessToken: mocks.refreshAccessToken,
}))

vi.mock('../../src/lib/get-client-headers.js', () => ({
  getClientHeaders: mocks.getClientHeaders,
}))

vi.mock('xero-node', () => ({
  XeroClient: class {
    accountingApi = {defaultHeaders: {}}

    setTokenSet(): void {}
  },
}))

const {createXeroClient, withRetry} = await import('../../src/lib/xero-client.js')

const cachedToken = {
  accessToken: 'expired-access-token',
  refreshToken: 'refresh-token',
  expiresAt: 0,
  tenantId: 'tenant-id',
  tenantName: 'Tenant',
}

describe('refresh failures in the Xero client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCachedTokenSet.mockResolvedValue(cachedToken)
    mocks.getClientHeaders.mockReturnValue({headers: {}})
  })

  it('retains credentials when an expired token cannot be refreshed transiently', async () => {
    const transientError = new TypeError('fetch failed')
    mocks.isTokenExpired.mockReturnValue(true)
    mocks.refreshAccessToken.mockRejectedValue(transientError)
    mocks.isInvalidRefreshTokenError.mockReturnValue(false)

    await expect(createXeroClient('profile', 'client-id')).rejects.toThrow(
      'Unable to refresh Xero session. Please try again.',
    )

    expect(mocks.clearCachedToken).not.toHaveBeenCalled()
    expect(mocks.cacheTokenSet).not.toHaveBeenCalled()
    expect(mocks.isInvalidRefreshTokenError).toHaveBeenCalledWith(transientError)
  })

  it('retains credentials when the token endpoint responds with a 5xx error', async () => {
    const serviceError = new Error('Token refresh failed (503).')
    mocks.isTokenExpired.mockReturnValue(true)
    mocks.refreshAccessToken.mockRejectedValue(serviceError)
    mocks.isInvalidRefreshTokenError.mockReturnValue(false)

    await expect(createXeroClient('profile', 'client-id')).rejects.toThrow(
      'Unable to refresh Xero session. Please try again.',
    )

    expect(mocks.clearCachedToken).not.toHaveBeenCalled()
    expect(mocks.cacheTokenSet).not.toHaveBeenCalled()
    expect(mocks.isInvalidRefreshTokenError).toHaveBeenCalledWith(serviceError)
  })

  it('clears credentials only when the refresh token is confirmed invalid', async () => {
    const invalidGrantError = new Error('invalid_grant')
    mocks.isTokenExpired.mockReturnValue(true)
    mocks.refreshAccessToken.mockRejectedValue(invalidGrantError)
    mocks.isInvalidRefreshTokenError.mockImplementation((error) => error === invalidGrantError)

    await expect(createXeroClient('profile', 'client-id')).rejects.toThrow(
      'Session expired. Run "xero login" to re-authenticate.',
    )

    expect(mocks.clearCachedToken).toHaveBeenCalledTimes(1)
    expect(mocks.clearCachedToken).toHaveBeenCalledWith('profile')
    expect(mocks.cacheTokenSet).not.toHaveBeenCalled()
  })

  it('retains credentials when a 401 retry cannot refresh the token transiently', async () => {
    const transientError = new Error('token endpoint unavailable')
    mocks.isTokenExpired.mockReturnValue(false)
    mocks.refreshAccessToken.mockRejectedValue(transientError)
    mocks.isInvalidRefreshTokenError.mockReturnValue(false)

    await expect(withRetry(
      'profile',
      'client-id',
      async () => {
        throw new Error(JSON.stringify({response: {statusCode: 401}}))
      },
      1,
    )).rejects.toThrow('Unable to refresh Xero session. Please try again.')

    expect(mocks.clearCachedToken).not.toHaveBeenCalled()
    expect(mocks.refreshAccessToken).toHaveBeenCalledWith('client-id', 'refresh-token')
  })

  it('clears credentials when a 401 retry confirms invalid_grant', async () => {
    const invalidGrantError = new Error('invalid_grant')
    mocks.isTokenExpired.mockReturnValue(false)
    mocks.refreshAccessToken.mockRejectedValue(invalidGrantError)
    mocks.isInvalidRefreshTokenError.mockImplementation((error) => error === invalidGrantError)

    await expect(withRetry(
      'profile',
      'client-id',
      async () => {
        throw new Error(JSON.stringify({response: {statusCode: 401}}))
      },
      1,
    )).rejects.toThrow('Session expired. Run "xero login" to re-authenticate.')

    expect(mocks.clearCachedToken).toHaveBeenCalledTimes(1)
    expect(mocks.clearCachedToken).toHaveBeenCalledWith('profile')
  })
})
