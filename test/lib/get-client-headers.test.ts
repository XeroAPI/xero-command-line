import {describe, it, expect} from 'vitest'
import {getPackageVersion} from '../../src/lib/get-package-version.js'
import {getClientHeaders} from '../../src/lib/get-client-headers.js'

describe('getPackageVersion', () => {
  it('returns the version from package.json', () => {
    const version = getPackageVersion()
    expect(version).toBe('0.0.1')
  })
})

describe('getClientHeaders', () => {
  it('returns headers with correct user-agent', () => {
    const result = getClientHeaders()
    expect(result).toEqual({
      headers: {
        'user-agent': 'xero-command-line-0.0.1',
      },
    })
  })
})
