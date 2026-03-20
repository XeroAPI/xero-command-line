import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class QuotesList extends BaseCommand {
  static override description = 'List quotes in Xero'

  static override examples = [
    '<%= config.bin %> quotes list',
    '<%= config.bin %> quotes list --contact-id abc-123',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Filter by contact ID'}),
    'quote-number': Flags.string({description: 'Filter by quote number'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(QuotesList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getQuotes(
        tenantId,
        undefined, // ifModifiedSince
        undefined, // dateFrom
        undefined, // dateTo
        undefined, // expiryDateFrom
        undefined, // expiryDateTo
        flags['contact-id'], // contactID
        undefined, // status
        flags.page, // page
        undefined, // order
        flags['quote-number'], // quoteNumber
      )
      return response.body.quotes ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'quoteNumber', header: 'Number'},
        {key: 'contact.name', header: 'Contact'},
        {key: 'title', header: 'Title'},
        {key: 'date', header: 'Date', format: (v) => formatDate(v)},
        {key: 'total', header: 'Total', format: (v) => formatCurrency(v)},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
