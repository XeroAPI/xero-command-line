import {describe, expect, it} from 'vitest'
import {
  ensureAccountNested,
  ensureBankAccountNested,
  ensureContactNested,
  ensureInvoiceNested,
} from '../../src/lib/file-data.js'

describe('file data ID normalization', () => {
  it('normalizes a nested camelCase contact ID', () => {
    expect(ensureContactNested({contact: {contactId: 'contact-id', name: 'Acme'}})).toEqual({
      contact: {contactID: 'contact-id', name: 'Acme'},
    })
  })

  it('normalizes a nested camelCase invoice ID', () => {
    expect(ensureInvoiceNested({invoice: {invoiceId: 'invoice-id'}})).toEqual({
      invoice: {invoiceID: 'invoice-id'},
    })
  })

  it('normalizes a nested camelCase account ID', () => {
    expect(ensureAccountNested({account: {accountId: 'account-id'}})).toEqual({
      account: {accountID: 'account-id'},
    })
  })

  it('normalizes a nested camelCase bank account ID', () => {
    expect(ensureBankAccountNested({bankAccount: {accountId: 'bank-account-id'}})).toEqual({
      bankAccount: {accountID: 'bank-account-id'},
    })
  })

  it('does not replace an existing nested object without an ID', () => {
    const data = {contact: {name: 'Acme'}, contactId: 'contact-id'}

    expect(ensureContactNested(data)).toBe(data)
  })
})
