import {Flags} from '@oclif/core'
import {BaseCommand} from '../base-command.js'
import {performLogin} from '../lib/oauth.js'
import {cacheTokenSet} from '../lib/auth.js'

export default class Login extends BaseCommand {
  static override description = 'Log in to Xero via browser (PKCE OAuth)'

  static override examples = [
    '<%= config.bin %> login',
    '<%= config.bin %> login -p acme-corp',
    '<%= config.bin %> login --scope "accounting.transactions.read accounting.contacts.read accounting.reports.read"',
  ]

  static override flags = {
    profile: Flags.string({
      char: 'p',
      description: 'Xero profile name',
      env: 'XERO_PROFILE',
    }),
    'client-id': Flags.string({
      description: 'Xero client ID (overrides profile)',
      env: 'XERO_CLIENT_ID',
    }),
    scope: Flags.string({
      description: 'Override OAuth scopes (space-separated). openid/profile/email/offline_access auto-prepended.',
      env: 'XERO_SCOPES',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)
    const {profileName, clientId} = this.resolveCredentials(flags)

    this.log('Opening browser for Xero login...')

    const {tokenSet, tenantId, tenantName} = await performLogin(clientId, flags.scope)
    await cacheTokenSet(profileName, tokenSet, tenantId, tenantName)

    this.log(`Logged in to ${tenantName}`)
  }
}
