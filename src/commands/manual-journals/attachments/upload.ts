import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {uploadAttachment} from '../../../lib/attachments.js'

export default class ManualJournalsAttachmentsUpload extends BaseCommand {
  static override description = 'Upload an attachment to a manual journal'

  static override examples = [
    '<%= config.bin %> manual-journals attachments upload --manual-journal-id abc-123 --file backup.pdf',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'manual-journal-id': Flags.string({description: 'Manual Journal ID', required: true}),
    file: Flags.string({description: 'Path to file to upload', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ManualJournalsAttachmentsUpload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      uploadAttachment(xero, tenantId, 'manualJournal', flags['manual-journal-id'], flags.file, false),
    )

    const r = result as Record<string, unknown>
    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(`Attachment uploaded: ${r.fileName} (${r.attachmentID})`)
    }
  }
}
