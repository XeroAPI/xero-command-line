import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {uploadAttachment} from '../../../lib/attachments.js'

export default class AccountsAttachmentsUpload extends BaseCommand {
  static override description = 'Upload an attachment to an account'

  static override examples = [
    '<%= config.bin %> accounts attachments upload --account-id abc-123 --file statement.pdf',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'account-id': Flags.string({description: 'Account ID', required: true}),
    file: Flags.string({description: 'Path to file to upload', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AccountsAttachmentsUpload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      uploadAttachment(xero, tenantId, 'account', flags['account-id'], flags.file, false),
    )

    const r = result as Record<string, unknown>
    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(`Attachment uploaded: ${r.fileName} (${r.attachmentID})`)
    }
  }
}
