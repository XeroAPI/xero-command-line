import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {contactCreateSchema, formatZodError} from '../../lib/validators.js'
import {contactDeepLink} from '../../lib/deeplinks.js'
import type {Contact} from 'xero-node'

export default class ContactsCreate extends BaseCommand {
  static override description = 'Create a contact in Xero'

  static override examples = [
    '<%= config.bin %> contacts create --name "Acme Corp" --email acme@example.com',
    '<%= config.bin %> contacts create --file contact.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with contact data'}),
    name: Flags.string({description: 'Contact name'}),
    email: Flags.string({description: 'Contact email'}),
    phone: Flags.string({description: 'Contact phone'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ContactsCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        name: flags.name,
        email: flags.email,
        phone: flags.phone,
      }
    }

    const parsed = contactCreateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const {resource: result, shortCode} = await this.xeroCall(flags, async (xero, tenantId) => {
      const contact: Contact = {
        name: parsed.data.name,
        emailAddress: parsed.data.email,
        phones: parsed.data.phone ? [{phoneNumber: parsed.data.phone}] : undefined,
      }
      const response = await xero.accountingApi.createContacts(tenantId, {contacts: [contact]})
      const shortCode = await this.getOrgShortCode(xero, tenantId)
      return {resource: response.body.contacts?.[0], shortCode}
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Contact created: ${r?.name} (${r?.contactID})`)
      if (shortCode && r?.contactID) {
        this.log(`View in Xero: ${contactDeepLink(shortCode, r.contactID as string)}`)
      }
    }
  }
}
