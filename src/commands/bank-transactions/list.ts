import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class BankTransactionsList extends BaseCommand {
  static override description = 'List bank transactions in Xero'

  static override examples = [
    '<%= config.bin %> bank-transactions list',
    '<%= config.bin %> bank-transactions list --bank-account-id abc-123',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'bank-account-id': Flags.string({description: 'Filter by bank account ID'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(BankTransactionsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const where = flags['bank-account-id']
        ? `BankAccount.AccountID=guid("${flags['bank-account-id']}")`
        : undefined
      const response = await xero.accountingApi.getBankTransactions(
        tenantId,
        undefined,
        where,
        undefined,
        flags.page,
      )
      return response.body.bankTransactions ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'bankTransactionID', header: 'ID'},
        {key: 'type', header: 'Type'},
        {key: 'contact.name', header: 'Contact'},
        {key: 'date', header: 'Date', format: (v) => formatDate(v)},
        {key: 'total', header: 'Total', format: (v) => formatCurrency(v)},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
