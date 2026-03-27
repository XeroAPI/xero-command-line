import {BaseCommand} from '../../base-command.js'

export default class CurrenciesList extends BaseCommand {
  static override description = 'List currencies in Xero'

  static override examples = [
    '<%= config.bin %> currencies list',
    '<%= config.bin %> currencies list --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CurrenciesList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getCurrencies(tenantId)
      return response.body.currencies ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'code', header: 'Code'},
        {key: 'description', header: 'Description'},
      ],
      flags,
    )
  }
}
