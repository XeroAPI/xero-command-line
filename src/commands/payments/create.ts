import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {paymentCreateSchema, formatZodError} from '../../lib/validators.js'
import {paymentDeepLink} from '../../lib/deeplinks.js'
import type {Payment} from 'xero-node'

export default class PaymentsCreate extends BaseCommand {
  static override description = 'Create a payment against an invoice in Xero'

  static override examples = [
    '<%= config.bin %> payments create --invoice-id abc-123 --account-id def-456 --amount 500',
    '<%= config.bin %> payments create --file payment.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with payment data'}),
    'invoice-id': Flags.string({description: 'Invoice ID'}),
    'account-id': Flags.string({description: 'Payment account ID'}),
    amount: Flags.string({description: 'Payment amount'}),
    date: Flags.string({description: 'Payment date (YYYY-MM-DD)'}),
    reference: Flags.string({description: 'Payment reference'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(PaymentsCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        invoiceId: flags['invoice-id'],
        accountId: flags['account-id'],
        amount: flags.amount ? Number(flags.amount) : undefined,
        date: flags.date,
        reference: flags.reference,
      }
    }

    const parsed = paymentCreateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const {resource: result, shortCode} = await this.xeroCall(flags, async (xero, tenantId) => {
      const payment: Payment = {
        invoice: {invoiceID: parsed.data.invoiceId},
        account: {accountID: parsed.data.accountId},
        amount: parsed.data.amount,
        date: parsed.data.date,
        reference: parsed.data.reference,
      }

      const response = await xero.accountingApi.createPayment(tenantId, payment)
      const shortCode = await this.getOrgShortCode(xero, tenantId)
      return {resource: response.body.payments?.[0], shortCode}
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Payment created: ${r?.paymentID}`)
      if (shortCode && r?.paymentID) {
        this.log(`View in Xero: ${paymentDeepLink(shortCode, r.paymentID as string)}`)
      }
    }
  }
}
