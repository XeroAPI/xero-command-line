import {describe, expect, it, vi} from 'vitest'
import BankTransactionsList from '../../src/commands/bank-transactions/list.js'
import CreditNotesList from '../../src/commands/credit-notes/list.js'
import PaymentsList from '../../src/commands/payments/list.js'

describe('list filters', () => {
  it('uses Xero equality operators for bank transaction filters', async () => {
    const getBankTransactions = vi.fn().mockResolvedValue({body: {bankTransactions: []}})
    const command = Object.create(BankTransactionsList.prototype) as BankTransactionsList

    Object.assign(command, {
      parse: vi.fn().mockResolvedValue({flags: {
        'bank-account-id': 'account-id',
        'bank-transaction-id': 'transaction-id',
        page: 1,
      }}),
      xeroCall: vi.fn(async (_flags, operation) => operation({
        accountingApi: {getBankTransactions},
      }, 'tenant-id')),
      log: vi.fn(),
      outputFormatted: vi.fn(),
    })

    await command.run()

    expect(getBankTransactions).toHaveBeenCalledWith(
      'tenant-id',
      undefined,
      'BankAccount.AccountID==guid("account-id") AND BankTransactionID==guid("transaction-id")',
      undefined,
      1,
    )
  })

  it('uses Xero equality operators for credit note filters', async () => {
    const getCreditNotes = vi.fn().mockResolvedValue({body: {creditNotes: []}})
    const command = Object.create(CreditNotesList.prototype) as CreditNotesList

    Object.assign(command, {
      parse: vi.fn().mockResolvedValue({flags: {
        'contact-id': 'contact-id',
        'credit-note-number': 'CN-0001',
        page: 1,
      }}),
      xeroCall: vi.fn(async (_flags, operation) => operation({
        accountingApi: {getCreditNotes},
      }, 'tenant-id')),
      log: vi.fn(),
      outputFormatted: vi.fn(),
    })

    await command.run()

    expect(getCreditNotes).toHaveBeenCalledWith(
      'tenant-id',
      undefined,
      'Contact.ContactID==guid("contact-id") AND CreditNoteNumber=="CN-0001"',
      undefined,
      1,
    )
  })

  it('uses Xero equality operators for payment filters', async () => {
    const getPayments = vi.fn().mockResolvedValue({body: {payments: []}})
    const command = Object.create(PaymentsList.prototype) as PaymentsList

    Object.assign(command, {
      parse: vi.fn().mockResolvedValue({flags: {
        'invoice-id': 'invoice-id',
        'invoice-number': 'INV-0001',
        reference: 'June payment',
        page: 1,
      }}),
      xeroCall: vi.fn(async (_flags, operation) => operation({
        accountingApi: {getPayments},
      }, 'tenant-id')),
      outputFormatted: vi.fn(),
    })

    await command.run()

    expect(getPayments).toHaveBeenCalledWith(
      'tenant-id',
      undefined,
      'Invoice.InvoiceID==guid("invoice-id") AND Invoice.InvoiceNumber=="INV-0001" AND Reference=="June payment"',
      undefined,
      1,
    )
  })
})
