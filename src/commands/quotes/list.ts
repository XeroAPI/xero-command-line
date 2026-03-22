import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatOutput, formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class QuotesList extends BaseCommand {
  static override description = 'List quotes in Xero'

  static override examples = [
    '<%= config.bin %> quotes list',
    '<%= config.bin %> quotes list --contact-id abc-123',
    '<%= config.bin %> quotes list --quote-number QU-0001',
    '<%= config.bin %> quotes list --quote-number QU-0001 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Filter by contact ID'}),
    'quote-number': Flags.string({description: 'Filter by quote number'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  private readonly quoteColumns = [
    {key: 'quoteID', header: 'ID'},
    {key: 'quoteNumber', header: 'Number'},
    {key: 'contact.name', header: 'Contact'},
    {key: 'title', header: 'Title'},
    {key: 'date', header: 'Date', format: (v: unknown) => formatDate(v)},
    {key: 'total', header: 'Total', format: (v: unknown) => formatCurrency(v)},
    {key: 'status', header: 'Status', format: (v: unknown) => formatStatus(String(v ?? ''))},
  ]

  private readonly lineItemColumns = [
    {key: 'description', header: 'Description'},
    {key: 'quantity', header: 'Qty', format: (v: unknown) => String(v ?? '')},
    {key: 'unitAmount', header: 'Unit Price', format: (v: unknown) => formatCurrency(v)},
    {key: 'taxType', header: 'Tax Type'},
    {key: 'accountCode', header: 'Account'},
    {key: 'lineAmount', header: 'Amount', format: (v: unknown) => formatCurrency(v)},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(QuotesList)

    const hasQuoteNumber = Boolean(flags['quote-number'])

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

    const quotes = result as unknown as Record<string, unknown>[]

    if (hasQuoteNumber && !flags.json) {
      if (flags.csv) {
        const mergedColumns = [
          ...this.quoteColumns,
          ...this.lineItemColumns,
        ]
        const flatRows: Record<string, unknown>[] = []
        for (const quote of quotes) {
          const lineItems = (quote.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            for (const item of lineItems) {
              flatRows.push({...quote, ...item})
            }
          } else {
            flatRows.push({...quote})
          }
        }

        this.log(formatOutput(flatRows, mergedColumns, 'csv'))
      } else {
        for (const quote of quotes) {
          const num = quote.quoteNumber ?? ''
          const contact = (quote.contact as Record<string, unknown>)?.name ?? ''
          const title = quote.title ?? ''
          const date = formatDate(quote.date)
          const status = formatStatus(String(quote.status ?? ''))
          const total = formatCurrency(quote.total)

          this.log(`Quote: ${num} | ${contact} | ${title} | ${date} | ${status}`)
          this.log(`Total: ${total}`)

          const lineItems = (quote.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            this.outputFormatted(lineItems, this.lineItemColumns, flags)
          }

          this.log('')
        }
      }
    } else {
      this.outputFormatted(quotes, this.quoteColumns, flags)
    }
  }
}
