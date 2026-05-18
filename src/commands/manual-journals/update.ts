import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {journalFileUpdateSchema, formatZodError} from '../../lib/validators.js'
import type {ManualJournal} from 'xero-node'

export default class ManualJournalsUpdate extends BaseCommand {
  static override description = 'Update a draft manual journal in Xero'

  static override examples = [
    '<%= config.bin %> manual-journals update --file journal-update.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with journal update data', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ManualJournalsUpdate)

    const fileData = this.readJsonFile(flags.file) as Record<string, unknown>

    const parsed = journalFileUpdateSchema.safeParse(fileData)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const manualJournalID = parsed.data.manualJournalID

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.updateManualJournal(tenantId, manualJournalID, {manualJournals: [fileData as unknown as ManualJournal]})
      return response.body.manualJournals?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Manual journal updated: ${r?.manualJournalID}`)
    }
  }
}
