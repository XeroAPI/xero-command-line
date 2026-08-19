import {Flags} from '@oclif/core'
import {BaseCommand} from '../base-command.js'
import {clearCachedToken} from '../lib/auth.js'
import {getDefaultProfile} from '../lib/profiles.js'
import {
  getCredentialCacheKeysToClear,
  isInlineCredentialSelector,
  resolveCredentialCacheKey,
} from '../lib/credential-cache-key.js'

export default class Logout extends BaseCommand {
  static override description = 'Log out from Xero (clear cached tokens)'

  static override examples = [
    '<%= config.bin %> logout',
    '<%= config.bin %> logout -p acme-corp',
    '<%= config.bin %> logout --client-id YOUR_CLIENT_ID',
  ]

  static override flags = {
    profile: Flags.string({
      char: 'p',
      description: 'Xero profile name',
      env: 'XERO_PROFILE',
    }),
    'client-id': Flags.string({
      // No env binding: an ambient XERO_CLIENT_ID must not silently retarget a
      // logout away from the profile the user asked for.
      description: 'Xero client ID for an inline login',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logout)
    const profileName = resolveCredentialCacheKey(flags) ?? getDefaultProfile()

    if (!profileName) {
      this.error('No profile configured. Nothing to log out from.')
    }

    for (const cacheKey of getCredentialCacheKeysToClear(flags, profileName)) {
      clearCachedToken(cacheKey)
    }

    const sessionDescription = isInlineCredentialSelector(flags)
      ? 'inline client credentials'
      : `profile "${flags.profile ?? profileName}"`
    this.log(`Logged out from ${sessionDescription}. Run "xero login" to re-authenticate.`)
  }
}
