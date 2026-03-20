import {Args} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {profileExists, removeProfile} from '../../lib/profiles.js'

export default class ProfileRemove extends BaseCommand {
  static override args = {
    name: Args.string({description: 'Profile name to remove', required: true}),
  }

  static override description = 'Remove a Xero connection profile'

  static override examples = ['<%= config.bin %> profile remove acme-corp']

  async run(): Promise<void> {
    const {args} = await this.parse(ProfileRemove)
    const {name} = args

    if (!profileExists(name)) {
      this.error(`Profile "${name}" not found.`)
    }

    removeProfile(name)
    this.log(`Profile "${name}" removed.`)
  }
}
