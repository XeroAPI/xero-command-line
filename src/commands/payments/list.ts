import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatCurrency, formatDate} from '../../lib/formatters.js'

export default class PaymentsList extends BaseCommand {
  static override description = 'List payments in Xero'

  static override examples = [
    '<%= config.bin %> payments list',
    '<%= config.bin %> payments list --invoice-id abc-123',
    '<%= config.bin %> payments list --invoice-number INV-0001',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'invoice-id': Flags.string({description: 'Filter by invoice ID'}),
    'invoice-number': Flags.string({description: 'Filter by invoice number'}),
    'payment-id': Flags.string({description: 'Get a specific payment'}),
    reference: Flags.string({description: 'Filter by reference'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(PaymentsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      if (flags['payment-id']) {
        const response = await xero.accountingApi.getPayment(tenantId, flags['payment-id'])
        const payment = response.body.payments?.[0]
        return payment ? [payment] : []
      }

      const whereClauses: string[] = []
      if (flags['invoice-id']) {
        whereClauses.push(`Invoice.InvoiceID=guid("${flags['invoice-id']}")`)
      }
      if (flags['invoice-number']) {
        whereClauses.push(`Invoice.InvoiceNumber="${flags['invoice-number']}"`)
      }
      if (flags.reference) {
        whereClauses.push(`Reference="${flags.reference}"`)
      }
      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : undefined

      const response = await xero.accountingApi.getPayments(
        tenantId,
        undefined,
        where,
        undefined,
        flags.page,
      )
      return response.body.payments ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'paymentID', header: 'ID'},
        {key: 'invoice.invoiceNumber', header: 'Invoice'},
        {key: 'date', header: 'Date', format: (v) => formatDate(v)},
        {key: 'amount', header: 'Amount', format: (v) => formatCurrency(v)},
        {key: 'reference', header: 'Reference'},
        {key: 'status', header: 'Status'},
      ],
      flags,
    )
  }
}
