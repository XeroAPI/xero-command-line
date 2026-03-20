import {BaseCommand} from '../../base-command.js'
import {formatStatus} from '../../lib/formatters.js'

export default class AccountsList extends BaseCommand {
  static override description = 'List all accounts in Xero'

  static override examples = [
    '<%= config.bin %> accounts list',
    '<%= config.bin %> accounts list --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AccountsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getAccounts(tenantId)
      return response.body.accounts ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'code', header: 'Code'},
        {key: 'name', header: 'Name'},
        {key: 'type', header: 'Type'},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
        {key: '_class', header: 'Class'},
      ],
      flags,
    )
  }
}
