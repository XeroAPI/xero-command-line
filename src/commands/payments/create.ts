import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {paymentCreateSchema, paymentFileCreateSchema, formatZodError} from '../../lib/validators.js'
import {paymentDeepLink} from '../../lib/deeplinks.js'
import {ensureInvoiceNested, ensureAccountNested} from '../../lib/file-data.js'
import {formatMutationPreview, mutationSummary, runConfirmedMutation} from '../../lib/mutation-confirmation.js'
import type {Payment} from 'xero-node'

export default class PaymentsCreate extends BaseCommand {
  static override description = 'Create a payment against an invoice in Xero'

  static override examples = [
    '<%= config.bin %> payments create --invoice-id abc-123 --account-id def-456 --amount 500',
    '<%= config.bin %> payments create --file payment.json',
    '<%= config.bin %> payments create --file payment.json --dry-run',
    '<%= config.bin %> payments create --file payment.json --confirm <confirmation>',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with payment data'}),
    'invoice-id': Flags.string({description: 'Invoice ID'}),
    'account-id': Flags.string({description: 'Payment account ID'}),
    amount: Flags.string({description: 'Payment amount'}),
    date: Flags.string({description: 'Payment date (YYYY-MM-DD)'}),
    reference: Flags.string({description: 'Payment reference'}),
    'dry-run': Flags.boolean({description: 'Preview without creating a payment', default: false}),
    confirm: Flags.string({description: 'Organisation- and payload-bound value returned by --dry-run'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(PaymentsCreate)

    let paymentData: Payment
    if (flags.file) {
      const fileData = this.readJsonFile(flags.file) as Record<string, unknown>
      const parsed = paymentFileCreateSchema.safeParse(fileData)
      if (!parsed.success) {
        this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
      }
      paymentData = ensureAccountNested(ensureInvoiceNested(parsed.data)) as Payment
    } else {
      const data = {
        invoiceId: flags['invoice-id'],
        accountId: flags['account-id'],
        amount: flags.amount ? Number(flags.amount) : undefined,
        date: flags.date,
        reference: flags.reference,
      }

      const parsed = paymentCreateSchema.safeParse(data)
      if (!parsed.success) {
        this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
      }

      paymentData = {
        invoice: {invoiceID: parsed.data.invoiceId},
        account: {accountID: parsed.data.accountId},
        amount: parsed.data.amount,
        date: parsed.data.date,
        reference: parsed.data.reference,
      }
    }

    const outcome = await this.xeroCall(flags, async (xero, tenantId, tenantName) => runConfirmedMutation({
      operation: 'payments.create',
      tenantId,
      tenantName,
      payload: paymentData,
      proposed: mutationSummary(paymentData as Record<string, unknown>),
      dryRun: flags['dry-run'],
      confirmation: flags.confirm,
      mutate: async () => {
        const response = await xero.accountingApi.createPayment(tenantId, paymentData)
        const shortCode = await this.getOrgShortCode(xero, tenantId)
        return {resource: response.body.payments?.[0], shortCode}
      },
    }))

    if (!outcome.executed) {
      this.log(formatMutationPreview(outcome.preview, flags.json))
      return
    }

    const {resource: result, shortCode} = outcome.value
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
