import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {listAttachments} from '../../../lib/attachments.js'

export default class ManualJournalsAttachmentsList extends BaseCommand {
  static override description = 'List attachments on a manual journal'

  static override examples = [
    '<%= config.bin %> manual-journals attachments list --manual-journal-id abc-123',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'manual-journal-id': Flags.string({description: 'Manual Journal ID', required: true}),
  }

  private readonly columns = [
    {key: 'attachmentID', header: 'ID'},
    {key: 'fileName', header: 'File Name'},
    {key: 'mimeType', header: 'Type'},
    {key: 'contentLength', header: 'Size (bytes)'},
    {key: 'url', header: 'URL'},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(ManualJournalsAttachmentsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      listAttachments(xero, tenantId, 'manualJournal', flags['manual-journal-id']),
    )

    this.outputFormatted(result as unknown as Record<string, unknown>[], this.columns, flags)
  }
}
