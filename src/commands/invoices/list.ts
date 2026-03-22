import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatOutput, formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class InvoicesList extends BaseCommand {
  static override description = 'List invoices in Xero'

  static override examples = [
    '<%= config.bin %> invoices list',
    '<%= config.bin %> invoices list --contact-id abc-123',
    '<%= config.bin %> invoices list --invoice-number INV-0001',
    '<%= config.bin %> invoices list --invoice-number INV-0001 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Filter by contact ID', multiple: true}),
    'invoice-number': Flags.string({description: 'Filter by invoice number', multiple: true}),
    page: Flags.integer({description: 'Page number', default: 1}),
    'page-size': Flags.integer({description: 'Number of invoices per page', default: 10}),
  }

  private readonly invoiceColumns = [
    {key: 'invoiceNumber', header: 'Number'},
    {key: 'type', header: 'Type'},
    {key: 'contact.name', header: 'Contact'},
    {key: 'date', header: 'Date', format: (v: unknown) => formatDate(v)},
    {key: 'total', header: 'Total', format: (v: unknown) => formatCurrency(v)},
    {key: 'amountDue', header: 'Due', format: (v: unknown) => formatCurrency(v)},
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
    const {flags} = await this.parse(InvoicesList)

    const hasInvoiceNumber = Boolean(flags['invoice-number']?.length)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getInvoices(
        tenantId,
        undefined, // ifModifiedSince
        undefined, // where
        'UpdatedDateUTC DESC', // order
        undefined, // iDs
        flags['invoice-number'], // invoiceNumbers
        flags['contact-id'], // contactIDs
        undefined, // statuses
        flags.page, // page
        false, // includeArchived
        false, // createdByMyApp
        undefined, // unitdp
        false, // summaryOnly
        flags['page-size'], // pageSize
      )
      return response.body.invoices ?? []
    })

    const invoices = result as unknown as Record<string, unknown>[]

    if (hasInvoiceNumber && !flags.json) {
      if (flags.csv) {
        const mergedColumns = [
          ...this.invoiceColumns,
          ...this.lineItemColumns,
        ]
        const flatRows: Record<string, unknown>[] = []
        for (const invoice of invoices) {
          const lineItems = (invoice.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            for (const item of lineItems) {
              flatRows.push({...invoice, ...item})
            }
          } else {
            flatRows.push({...invoice})
          }
        }

        this.log(formatOutput(flatRows, mergedColumns, 'csv'))
      } else {
        for (const invoice of invoices) {
          const num = invoice.invoiceNumber ?? ''
          const contact = (invoice.contact as Record<string, unknown>)?.name ?? ''
          const date = formatDate(invoice.date)
          const status = formatStatus(String(invoice.status ?? ''))
          const total = formatCurrency(invoice.total)
          const due = formatCurrency(invoice.amountDue)

          this.log(`Invoice: ${num} | ${contact} | ${date} | ${status}`)
          this.log(`Total: ${total} | Due: ${due}`)

          const lineItems = (invoice.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            this.outputFormatted(lineItems, this.lineItemColumns, flags)
          }

          this.log('')
        }
      }
    } else {
      this.outputFormatted(invoices, this.invoiceColumns, flags)
    }
  }
}
