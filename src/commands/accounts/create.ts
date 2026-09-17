import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {accountCreateSchema, formatZodError} from '../../lib/validators.js'
import type {Account} from 'xero-node'

export default class AccountsCreate extends BaseCommand {
  static override description = 'Create an account in Xero'

  static override examples = [
    '<%= config.bin %> accounts create --name "Travel Expenses" --code 420 --type EXPENSE',
    '<%= config.bin %> accounts create --file account.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with account data'}),
    name: Flags.string({description: 'Account name'}),
    code: Flags.string({description: 'Account code'}),
    type: Flags.string({description: 'Account type (BANK, CURRENT, CURRLIAB, DEPRECIATN, DIRECTCOSTS, EQUITY, EXPENSE, FIXED, INVENTORY, LIABILITY, NONCURRENT, OTHERINCOME, OVERHEADS, PREPAYMENT, REVENUE, SALES, TERMLIAB, PAYG)'}),
    description: Flags.string({description: 'Account description'}),
    'tax-type': Flags.string({description: 'Tax type'}),
    'enable-payments-to-account': Flags.boolean({description: 'Enable payments to account', allowNo: true}),
    'show-in-expense-claims': Flags.boolean({description: 'Show in expense claims', allowNo: true}),
    'add-to-watchlist': Flags.boolean({description: 'Show on the Xero dashboard watchlist', allowNo: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AccountsCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        name: flags.name,
        code: flags.code,
        type: flags.type,
        description: flags.description,
        taxType: flags['tax-type'],
        enablePaymentsToAccount: flags['enable-payments-to-account'],
        showInExpenseClaims: flags['show-in-expense-claims'],
        addToWatchlist: flags['add-to-watchlist'],
      }
    }

    const parsed = accountCreateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const account: Account = {
        name: parsed.data.name,
        code: parsed.data.code,
        type: parsed.data.type as unknown as Account['type'],
        description: parsed.data.description,
        taxType: parsed.data.taxType,
        enablePaymentsToAccount: parsed.data.enablePaymentsToAccount,
        showInExpenseClaims: parsed.data.showInExpenseClaims,
        addToWatchlist: parsed.data.addToWatchlist,
      }
      const response = await xero.accountingApi.createAccount(tenantId, account)
      return response.body.accounts?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Account created: ${r?.name} (${r?.accountID})`)
    }
  }
}
