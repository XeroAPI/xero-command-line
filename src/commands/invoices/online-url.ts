import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {extractOnlineInvoiceResult} from '../../lib/invoices.js'

export default class InvoicesOnlineUrl extends BaseCommand {
  static override description = 'Get the customer-facing online URL for a non-draft ACCREC sales invoice'

  static override examples = [
    '<%= config.bin %> invoices online-url --invoice-id 00000000-0000-0000-0000-000000000001',
    '<%= config.bin %> invoices online-url --invoice-id 00000000-0000-0000-0000-000000000001 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'invoice-id': Flags.string({description: 'Invoice ID', required: true}),
  }

  private readonly resultColumns = [
    {key: 'invoiceID', header: 'Invoice ID'},
    {key: 'onlineInvoiceUrl', header: 'Online Invoice URL'},
    {key: 'available', header: 'Available'},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(InvoicesOnlineUrl)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getOnlineInvoice(tenantId, flags['invoice-id'])
      return extractOnlineInvoiceResult(flags['invoice-id'], response.body.onlineInvoices)
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else if (flags.csv || flags.toon) {
      this.outputFormatted([result as unknown as Record<string, unknown>], this.resultColumns, flags)
    } else if (result.onlineInvoiceUrl) {
      this.log(result.onlineInvoiceUrl)
    } else {
      this.log(`No online invoice URL available for invoice ${result.invoiceID}`)
    }
  }
}
