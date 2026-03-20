import {Flags} from '@oclif/core'
import {BaseCommand} from '../base-command.js'
import {clearCachedToken} from '../lib/auth.js'
import {getDefaultProfile} from '../lib/profiles.js'

export default class Logout extends BaseCommand {
  static override description = 'Log out from Xero (clear cached tokens)'

  static override examples = [
    '<%= config.bin %> logout',
    '<%= config.bin %> logout -p acme-corp',
  ]

  static override flags = {
    profile: Flags.string({
      char: 'p',
      description: 'Xero profile name',
      env: 'XERO_PROFILE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logout)
    const profileName = flags.profile ?? getDefaultProfile()

    if (!profileName) {
      this.error('No profile configured. Nothing to log out from.')
    }

    clearCachedToken(profileName)
    this.log(`Logged out from profile "${profileName}". Run "xero login" to re-authenticate.`)
  }
}
