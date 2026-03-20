import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {formatStatus} from '../../../lib/formatters.js'

export default class TrackingCategoriesList extends BaseCommand {
  static override description = 'List tracking categories in Xero'

  static override examples = [
    '<%= config.bin %> tracking categories list',
    '<%= config.bin %> tracking categories list --include-archived',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'include-archived': Flags.boolean({description: 'Include archived categories', default: false}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(TrackingCategoriesList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getTrackingCategories(
        tenantId,
        undefined,
        undefined,
        flags['include-archived'] || undefined,
      )
      return response.body.trackingCategories ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'trackingCategoryID', header: 'ID'},
        {key: 'name', header: 'Name'},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
