import chalk from 'chalk'
import {BaseCommand} from '../../base-command.js'
import {listProfiles} from '../../lib/profiles.js'

export default class ProfileList extends BaseCommand {
  static override description = 'List all configured profiles'

  static override examples = ['<%= config.bin %> profile list']

  async run(): Promise<void> {
    const {profiles, defaultProfile} = listProfiles()

    if (profiles.length === 0) {
      this.log('No profiles configured. Run "xero profile add <name>" to add one.')
      return
    }

    this.log('')
    for (const profile of profiles) {
      const isDefault = profile.name === defaultProfile
      const marker = isDefault ? chalk.green(' (default)') : ''
      const maskedId = profile.clientId.slice(0, 8) + '...'
      this.log(`  ${chalk.bold(profile.name)}${marker}`)
      this.log(`    Client ID: ${maskedId}`)
    }
    this.log('')
  }
}
