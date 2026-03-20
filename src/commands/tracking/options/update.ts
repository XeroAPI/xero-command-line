import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {trackingOptionsUpdateSchema, formatZodError} from '../../../lib/validators.js'
import type {TrackingOption} from 'xero-node'

export default class TrackingOptionsUpdate extends BaseCommand {
  static override description = 'Update tracking options for a category in Xero'

  static override examples = [
    '<%= config.bin %> tracking options update --file tracking-options.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with tracking options update data', required: true}),
    'category-id': Flags.string({description: 'Tracking category ID'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(TrackingOptionsUpdate)

    const data = this.readJsonFile(flags.file) as Record<string, unknown>
    if (flags['category-id']) {
      data.trackingCategoryId = flags['category-id']
    }

    const parsed = trackingOptionsUpdateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const results: unknown[] = []
    await this.xeroCall(flags, async (xero, tenantId) => {
      for (const opt of parsed.data.options) {
        const option: TrackingOption = {
          trackingOptionID: opt.trackingOptionId,
          name: opt.name,
          status: opt.status as TrackingOption['status'],
        }
        const response = await xero.accountingApi.updateTrackingOptions(
          tenantId,
          parsed.data.trackingCategoryId,
          opt.trackingOptionId,
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
      this.log(`Updated ${results.length} tracking option(s).`)
    }
  }
}
