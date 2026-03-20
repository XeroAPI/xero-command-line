import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class InvoicesList extends BaseCommand {
  static override description = 'List invoices in Xero'

  static override examples = [
    '<%= config.bin %> invoices list',
    '<%= config.bin %> invoices list --contact-id abc-123',
    '<%= config.bin %> invoices list --invoice-number INV-0001 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Filter by contact ID', multiple: true}),
    'invoice-number': Flags.string({description: 'Filter by invoice number', multiple: true}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(InvoicesList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getInvoices(
        tenantId,
        undefined,
        undefined,
        undefined,
        undefined,
        flags['invoice-number'],
        flags['contact-id'],
        undefined,
        flags.page,
      )
      return response.body.invoices ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'invoiceNumber', header: 'Number'},
        {key: 'type', header: 'Type'},
        {key: 'contact.name', header: 'Contact'},
        {key: 'date', header: 'Date', format: (v) => formatDate(v)},
        {key: 'total', header: 'Total', format: (v) => formatCurrency(v)},
        {key: 'amountDue', header: 'Due', format: (v) => formatCurrency(v)},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
