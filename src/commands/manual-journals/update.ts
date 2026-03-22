import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {journalUpdateSchema, formatZodError} from '../../lib/validators.js'
import type {ManualJournal, ManualJournalLine} from 'xero-node'

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

    const data = this.readJsonFile(flags.file) as Record<string, unknown>

    const parsed = journalUpdateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const journalLines: ManualJournalLine[] = parsed.data.manualJournalLines.map(line => ({
        accountCode: line.accountCode,
        lineAmount: line.lineAmount,
        description: line.description,
        taxType: line.taxType,
      }))

      const journal: ManualJournal = {
        manualJournalID: parsed.data.manualJournalID,
        narration: parsed.data.narration,
        journalLines: journalLines,
        date: parsed.data.date,
        lineAmountTypes: parsed.data.lineAmountTypes as ManualJournal['lineAmountTypes'],
        status: parsed.data.status as ManualJournal['status'],
        url: parsed.data.url,
        showOnCashBasisReports: parsed.data.showOnCashBasisReports,
      }

      const response = await xero.accountingApi.updateManualJournal(tenantId, parsed.data.manualJournalID, {manualJournals: [journal]})
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
