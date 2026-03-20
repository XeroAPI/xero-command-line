import {BaseCommand} from '../../base-command.js'

export default class OrgDetails extends BaseCommand {
  static override description = 'Show organisation details from Xero'

  static override examples = [
    '<%= config.bin %> org details',
    '<%= config.bin %> org details --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(OrgDetails)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getOrganisations(tenantId)
      return response.body.organisations ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'name', header: 'Name'},
        {key: 'legalName', header: 'Legal Name'},
        {key: 'shortCode', header: 'Short Code'},
        {key: 'organisationType', header: 'Type'},
        {key: 'baseCurrency', header: 'Currency'},
        {key: 'countryCode', header: 'Country'},
        {key: 'lineOfBusiness', header: 'Industry'},
      ],
      flags,
    )
  }
}
