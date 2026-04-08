import {readFileSync} from 'node:fs'
import {describe, it, expect} from 'vitest'
import {getPackageVersion} from '../../src/lib/get-package-version.js'
import {getClientHeaders} from '../../src/lib/get-client-headers.js'

const {version} = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'))

describe('getPackageVersion', () => {
  it('returns the version from package.json', () => {
    const result = getPackageVersion()
    expect(result).toBe(version)
  })
})

describe('getClientHeaders', () => {
  it('returns headers with correct user-agent', () => {
    const result = getClientHeaders()
    expect(result).toEqual({
      headers: {
        'user-agent': `xero-command-line-${version}`,
      },
    })
  })
})
