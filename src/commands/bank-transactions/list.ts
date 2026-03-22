import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatOutput, formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class BankTransactionsList extends BaseCommand {
  static override description = 'List bank transactions in Xero'

  static override examples = [
    '<%= config.bin %> bank-transactions list',
    '<%= config.bin %> bank-transactions list --bank-account-id abc-123',
    '<%= config.bin %> bank-transactions list --bank-transaction-id abc-123',
    '<%= config.bin %> bank-transactions list --bank-transaction-id abc-123 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'bank-account-id': Flags.string({description: 'Filter by bank account ID'}),
    'bank-transaction-id': Flags.string({description: 'Filter by bank transaction ID'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  private readonly transactionColumns = [
    {key: 'bankTransactionID', header: 'ID'},
    {key: 'type', header: 'Type'},
    {key: 'contact.name', header: 'Contact'},
    {key: 'date', header: 'Date', format: (v: unknown) => formatDate(v)},
    {key: 'total', header: 'Total', format: (v: unknown) => formatCurrency(v)},
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
    const {flags} = await this.parse(BankTransactionsList)

    const hasTransactionId = Boolean(flags['bank-transaction-id'])

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const whereClauses: string[] = []
      if (flags['bank-account-id']) {
        whereClauses.push(`BankAccount.AccountID=guid("${flags['bank-account-id']}")`)
      }

      if (flags['bank-transaction-id']) {
        whereClauses.push(`BankTransactionID=guid("${flags['bank-transaction-id']}")`)
      }

      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : undefined
      const response = await xero.accountingApi.getBankTransactions(
        tenantId,
        undefined,
        where,
        undefined,
        flags.page,
      )
      return response.body.bankTransactions ?? []
    })

    const transactions = result as unknown as Record<string, unknown>[]

    if (hasTransactionId && !flags.json) {
      if (flags.csv) {
        const mergedColumns = [
          ...this.transactionColumns,
          ...this.lineItemColumns,
        ]
        const flatRows: Record<string, unknown>[] = []
        for (const txn of transactions) {
          const lineItems = (txn.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            for (const item of lineItems) {
              flatRows.push({...txn, ...item})
            }
          } else {
            flatRows.push({...txn})
          }
        }

        this.log(formatOutput(flatRows, mergedColumns, 'csv'))
      } else {
        for (const txn of transactions) {
          const type = txn.type ?? ''
          const contact = (txn.contact as Record<string, unknown>)?.name ?? ''
          const date = formatDate(txn.date)
          const status = formatStatus(String(txn.status ?? ''))
          const total = formatCurrency(txn.total)

          this.log(`Bank Transaction: ${type} | ${contact} | ${date} | ${status}`)
          this.log(`Total: ${total}`)

          const lineItems = (txn.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            this.outputFormatted(lineItems, this.lineItemColumns, flags)
          }

          this.log('')
        }
      }
    } else {
      this.outputFormatted(transactions, this.transactionColumns, flags)
    }
  }
}
