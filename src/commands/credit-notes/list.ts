import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class CreditNotesList extends BaseCommand {
  static override description = 'List credit notes in Xero'

  static override examples = [
    '<%= config.bin %> credit-notes list',
    '<%= config.bin %> credit-notes list --contact-id abc-123',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Filter by contact ID'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const where = flags['contact-id']
        ? `Contact.ContactID=guid("${flags['contact-id']}")`
        : undefined
      const response = await xero.accountingApi.getCreditNotes(
        tenantId,
        undefined,
        where,
        undefined,
        flags.page,
      )
      return response.body.creditNotes ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'creditNoteID', header: 'ID'},
        {key: 'creditNoteNumber', header: 'Number'},
        {key: 'contact.name', header: 'Contact'},
        {key: 'date', header: 'Date', format: (v) => formatDate(v)},
        {key: 'total', header: 'Total', format: (v) => formatCurrency(v)},
        {key: 'remainingCredit', header: 'Remaining', format: (v) => formatCurrency(v)},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
