import {describe, expect, it, vi} from 'vitest'
import {Phone} from 'xero-node'
import ContactsUpdate from '../../../src/commands/contacts/update.js'

describe('contacts update phones', () => {
  it('sets an explicit phone type on a phone-only update', async () => {
    const updateContact = vi.fn().mockResolvedValue({body: {contacts: [{}]}})
    const command = Object.create(ContactsUpdate.prototype) as ContactsUpdate

    Object.assign(command, {
      parse: vi.fn().mockResolvedValue({flags: {
        'contact-id': 'contact-123',
        phone: '+61400000000',
      }}),
      xeroCall: vi.fn(async (_flags, operation) => operation({
        accountingApi: {updateContact},
      }, 'tenant-id')),
      log: vi.fn(),
    })

    await command.run()

    expect(updateContact).toHaveBeenCalledWith(
      'tenant-id',
      'contact-123',
      {contacts: [expect.objectContaining({
        phones: [{phoneNumber: '+61400000000', phoneType: Phone.PhoneTypeEnum.DEFAULT}],
      })]},
    )
  })
})
