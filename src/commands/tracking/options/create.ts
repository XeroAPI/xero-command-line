import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {trackingOptionsCreateSchema, formatZodError} from '../../../lib/validators.js'
import type {TrackingOption} from 'xero-node'

export default class TrackingOptionsCreate extends BaseCommand {
  static override description = 'Create tracking options for a category in Xero'

  static override examples = [
    '<%= config.bin %> tracking options create --category-id abc-123 --names "Sales,Marketing,Engineering"',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'category-id': Flags.string({description: 'Tracking category ID', required: true}),
    names: Flags.string({description: 'Comma-separated option names', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(TrackingOptionsCreate)

    const optionNames = flags.names.split(',').map(n => n.trim())

    const parsed = trackingOptionsCreateSchema.safeParse({
      trackingCategoryId: flags['category-id'],
      optionNames,
    })
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const results: unknown[] = []
    await this.xeroCall(flags, async (xero, tenantId) => {
      for (const name of parsed.data.optionNames) {
        const option: TrackingOption = {name}
        const response = await xero.accountingApi.createTrackingOptions(
          tenantId,
          parsed.data.trackingCategoryId,
          option,
        )
        if (response.body.options) {
          results.push(...response.body.options)
        }
      }
    })

    if (flags.json) {
      this.log(JSON.stringify(results, null, 2))
    } else {
      this.log(`Created ${results.length} tracking option(s) for category ${flags['category-id']}.`)
    }
  }
}
