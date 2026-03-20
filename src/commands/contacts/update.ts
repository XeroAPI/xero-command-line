import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {contactUpdateSchema, formatZodError} from '../../lib/validators.js'
import type {Contact, Phone, Address} from 'xero-node'

export default class ContactsUpdate extends BaseCommand {
  static override description = 'Update a contact in Xero'

  static override examples = [
    '<%= config.bin %> contacts update --contact-id abc-123 --name "New Name"',
    '<%= config.bin %> contacts update --file contact-update.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with contact update data'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    name: Flags.string({description: 'Contact name'}),
    email: Flags.string({description: 'Contact email'}),
    phone: Flags.string({description: 'Contact phone'}),
    'first-name': Flags.string({description: 'First name'}),
    'last-name': Flags.string({description: 'Last name'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ContactsUpdate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        contactId: flags['contact-id'],
        name: flags.name,
        email: flags.email,
        phone: flags.phone,
        firstName: flags['first-name'],
        lastName: flags['last-name'],
      }
    }

    const parsed = contactUpdateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const contact: Contact = {
        contactID: parsed.data.contactId,
        name: parsed.data.name,
        emailAddress: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phones: parsed.data.phone ? [{phoneNumber: parsed.data.phone} as Phone] : undefined,
        addresses: parsed.data.address ? [parsed.data.address as Address] : undefined,
      }
      const response = await xero.accountingApi.updateContact(tenantId, parsed.data.contactId, {contacts: [contact]})
      return response.body.contacts?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Contact updated: ${r?.name} (${r?.contactID})`)
    }
  }
}
