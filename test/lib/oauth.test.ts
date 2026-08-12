import {describe, expect, it} from 'vitest'
import {escapeHtml, parseOAuthCallback} from '../../src/lib/oauth.js'

describe('escapeHtml', () => {
  it('escapes provider-supplied callback error text for HTML', () => {
    const message = '</p><script>alert("injected")</script>&\''

    expect(escapeHtml(message)).toBe('&lt;/p&gt;&lt;script&gt;alert(&quot;injected&quot;)&lt;/script&gt;&amp;&#39;')
  })
})

describe('parseOAuthCallback', () => {
  it('rejects an error callback before using its provider-controlled text when state is wrong', () => {
    const url = new URL('http://localhost/callback?state=wrong&error=denied&error_description=untrusted')

    expect(parseOAuthCallback(url, 'expected')).toEqual({kind: 'invalid'})
  })

  it('accepts matching-state success and error callbacks', () => {
    expect(parseOAuthCallback(new URL('http://localhost/callback?state=expected&code=code'), 'expected')).toEqual({
      kind: 'success',
      code: 'code',
    })
    expect(parseOAuthCallback(new URL('http://localhost/callback?state=expected&error=denied'), 'expected')).toEqual({
      kind: 'error',
      description: 'denied',
    })
  })
})
