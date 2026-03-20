import {Args, Flags} from '@oclif/core'
import {input} from '@inquirer/prompts'
import {BaseCommand} from '../../base-command.js'
import {addProfile, profileExists} from '../../lib/profiles.js'

export default class ProfileAdd extends BaseCommand {
  static override args = {
    name: Args.string({description: 'Profile name', required: true}),
  }

  static override description = 'Add a new Xero connection profile'

  static override examples = [
    '<%= config.bin %> profile add acme-corp',
    '<%= config.bin %> profile add acme-corp --client-id xxx',
  ]

  static override flags = {
    'client-id': Flags.string({description: 'Xero client ID'}),
    force: Flags.boolean({char: 'f', description: 'Overwrite existing profile', default: false}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ProfileAdd)
    const {name} = args

    if (profileExists(name) && !flags.force) {
      this.error(`Profile "${name}" already exists. Use --force to overwrite.`)
    }

    const clientId = flags['client-id'] ?? await input({
      message: 'Xero Client ID:',
      validate: (v) => v.length > 0 || 'Client ID is required',
    })

    addProfile(name, clientId)

    this.log(`Profile "${name}" added successfully.`)
    this.log('Run "xero login" to authenticate with Xero.')
  }
}
