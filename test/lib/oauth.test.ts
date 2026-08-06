import {describe, expect, it} from 'vitest'
import {escapeHtml} from '../../src/lib/oauth.js'

describe('escapeHtml', () => {
  it('escapes provider-supplied callback error text for HTML', () => {
    const message = '</p><script>alert("injected")</script>&\''

    expect(escapeHtml(message)).toBe('&lt;/p&gt;&lt;script&gt;alert(&quot;injected&quot;)&lt;/script&gt;&amp;&#39;')
  })
})
