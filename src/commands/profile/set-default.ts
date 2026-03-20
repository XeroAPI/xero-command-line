import {Args} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {setDefaultProfile} from '../../lib/profiles.js'

export default class ProfileSetDefault extends BaseCommand {
  static override args = {
    name: Args.string({description: 'Profile name to set as default', required: true}),
  }

  static override description = 'Set the default Xero profile'

  static override examples = ['<%= config.bin %> profile set-default acme-corp']

  async run(): Promise<void> {
    const {args} = await this.parse(ProfileSetDefault)
    const {name} = args

    setDefaultProfile(name)
    this.log(`Default profile set to "${name}".`)
  }
}
