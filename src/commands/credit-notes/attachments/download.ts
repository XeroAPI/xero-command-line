import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {downloadAttachment} from '../../../lib/attachments.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

export default class CreditNotesAttachmentsDownload extends BaseCommand {
  static override description = 'Download an attachment from a credit note'

  static override examples = [
    '<%= config.bin %> credit-notes attachments download --credit-note-id abc-123 --attachment-id def-456',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'credit-note-id': Flags.string({description: 'Credit Note ID', required: true}),
    'attachment-id': Flags.string({description: 'Attachment ID', required: true}),
    output: Flags.string({description: 'Output path (file or directory). Defaults to current directory.'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesAttachmentsDownload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      downloadAttachment(xero, tenantId, 'creditNote', flags['credit-note-id'], flags['attachment-id']),
    )

    const {fileName, data} = result as {fileName: string; data: Buffer}
    const outputPath = resolveOutputPath(flags.output, fileName)
    fs.writeFileSync(outputPath, data)
    this.log(`Saved: ${outputPath}`)
  }
}

function resolveOutputPath(output: string | undefined, fileName: string): string {
  if (!output) return path.join(process.cwd(), fileName)
  if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
    return path.join(output, fileName)
  }
  return output
}
