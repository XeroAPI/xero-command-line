import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatStatus} from '../../lib/formatters.js'

export default class ContactGroupsList extends BaseCommand {
  static override description = 'List contact groups in Xero'

  static override examples = [
    '<%= config.bin %> contact-groups list',
    '<%= config.bin %> contact-groups list --group-id abc-123',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'group-id': Flags.string({description: 'Get details for a specific contact group'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ContactGroupsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      if (flags['group-id']) {
        const response = await xero.accountingApi.getContactGroup(tenantId, flags['group-id'])
        const group = response.body.contactGroups?.[0]
        return group ? [group] : []
      }
      const response = await xero.accountingApi.getContactGroups(tenantId)
      return response.body.contactGroups ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'contactGroupID', header: 'ID'},
        {key: 'name', header: 'Name'},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
