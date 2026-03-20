import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {bankTransactionCreateSchema, formatZodError} from '../../lib/validators.js'
import {bankTransactionDeepLink} from '../../lib/deeplinks.js'
import {BankTransaction} from 'xero-node'
import type {LineItem} from 'xero-node'

export default class BankTransactionsCreate extends BaseCommand {
  static override description = 'Create a bank transaction in Xero'

  static override examples = [
    '<%= config.bin %> bank-transactions create --file bank-transaction.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with bank transaction data'}),
    type: Flags.string({description: 'Transaction type (RECEIVE or SPEND)', options: ['RECEIVE', 'SPEND']}),
    'bank-account-id': Flags.string({description: 'Bank account ID'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    date: Flags.string({description: 'Transaction date (YYYY-MM-DD)'}),
    reference: Flags.string({description: 'Transaction reference'}),
    description: Flags.string({description: 'Line item description'}),
    quantity: Flags.string({description: 'Line item quantity'}),
    'unit-amount': Flags.string({description: 'Line item unit amount'}),
    'account-code': Flags.string({description: 'Line item account code'}),
    'tax-type': Flags.string({description: 'Line item tax type'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(BankTransactionsCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        type: flags.type,
        bankAccountId: flags['bank-account-id'],
        contactId: flags['contact-id'],
        date: flags.date,
        reference: flags.reference,
        lineItems: [{
          description: flags.description,
          quantity: flags.quantity ? Number(flags.quantity) : undefined,
          unitAmount: flags['unit-amount'] ? Number(flags['unit-amount']) : undefined,
          accountCode: flags['account-code'],
          taxType: flags['tax-type'],
        }],
      }
    }

    const parsed = bankTransactionCreateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const {resource: result, shortCode} = await this.xeroCall(flags, async (xero, tenantId) => {
      const lineItems: LineItem[] = parsed.data.lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        accountCode: li.accountCode,
        taxType: li.taxType,
      }))

      const bankTransaction: BankTransaction = {
        type: BankTransaction.TypeEnum[parsed.data.type as keyof typeof BankTransaction.TypeEnum],
        bankAccount: {accountID: parsed.data.bankAccountId},
        contact: {contactID: parsed.data.contactId},
        lineItems,
        date: parsed.data.date,
        reference: parsed.data.reference,
      }

      const response = await xero.accountingApi.createBankTransactions(tenantId, {bankTransactions: [bankTransaction]})
      const shortCode = await this.getOrgShortCode(xero, tenantId)
      return {resource: response.body.bankTransactions?.[0], shortCode}
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Bank transaction created: ${r?.bankTransactionID}`)
      if (shortCode && r?.bankTransactionID) {
        this.log(`View in Xero: ${bankTransactionDeepLink(shortCode, r.bankTransactionID as string)}`)
      }
    }
  }
}
