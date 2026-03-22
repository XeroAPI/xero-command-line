import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatStatus} from '../../lib/formatters.js'

export default class ContactsList extends BaseCommand {
  static override description = 'List contacts in Xero'

  static override examples = [
    '<%= config.bin %> contacts list',
    '<%= config.bin %> contacts list --search "Acme"',
    '<%= config.bin %> contacts list --page 2 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    search: Flags.string({description: 'Search by name, email, or contact number'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ContactsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getContacts(
        tenantId,
        undefined, // ifModifiedSince
        undefined, // where
        undefined, // order
        undefined, // iDs
        flags.page, // page
        undefined, // includeArchived
        undefined, // summaryOnly
        flags.search, // searchTerm
      )
      return response.body.contacts ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'contactID', header: 'ID'},
        {key: 'name', header: 'Name'},
        {key: 'emailAddress', header: 'Email'},
        {key: 'contactStatus', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
