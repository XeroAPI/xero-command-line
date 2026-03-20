import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {bankTransactionUpdateSchema, formatZodError} from '../../lib/validators.js'
import {BankTransaction} from 'xero-node'
import type {LineItem} from 'xero-node'

export default class BankTransactionsUpdate extends BaseCommand {
  static override description = 'Update a bank transaction in Xero'

  static override examples = [
    '<%= config.bin %> bank-transactions update --file bank-transaction-update.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with bank transaction update data'}),
    'bank-transaction-id': Flags.string({description: 'Bank transaction ID'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    type: Flags.string({description: 'Transaction type (RECEIVE or SPEND)', options: ['RECEIVE', 'SPEND']}),
    date: Flags.string({description: 'Transaction date (YYYY-MM-DD)'}),
    reference: Flags.string({description: 'Transaction reference'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(BankTransactionsUpdate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        bankTransactionId: flags['bank-transaction-id'],
        contactId: flags['contact-id'],
        type: flags.type,
        date: flags.date,
        reference: flags.reference,
      }
    }

    const parsed = bankTransactionUpdateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const bankTransaction = {
        bankTransactionID: parsed.data.bankTransactionId,
        contact: parsed.data.contactId ? {contactID: parsed.data.contactId} : undefined,
        type: parsed.data.type ? BankTransaction.TypeEnum[parsed.data.type as keyof typeof BankTransaction.TypeEnum] : undefined,
        date: parsed.data.date,
        reference: parsed.data.reference,
      } as BankTransaction

      if (parsed.data.lineItems) {
        bankTransaction.lineItems = parsed.data.lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitAmount: li.unitAmount,
          accountCode: li.accountCode,
          taxType: li.taxType,
        })) as LineItem[]
      }

      const response = await xero.accountingApi.updateBankTransaction(tenantId, parsed.data.bankTransactionId, {bankTransactions: [bankTransaction]})
      return response.body.bankTransactions?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Bank transaction updated: ${r?.bankTransactionID}`)
    }
  }
}
