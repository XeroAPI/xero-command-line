import {describe, it, expect} from 'vitest'
import {
  dateSchema,
  lineItemSchema,
  invoiceCreateSchema,
  contactCreateSchema,
  paymentCreateSchema,
  journalCreateSchema,
  formatZodError,
} from '../../src/lib/validators.js'

describe('dateSchema', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(dateSchema.safeParse('2025-01-15').success).toBe(true)
    expect(dateSchema.safeParse('2025-12-31').success).toBe(true)
  })

  it('rejects invalid date formats', () => {
    expect(dateSchema.safeParse('01-15-2025').success).toBe(false)
    expect(dateSchema.safeParse('2025/01/15').success).toBe(false)
    expect(dateSchema.safeParse('not-a-date').success).toBe(false)
    expect(dateSchema.safeParse('').success).toBe(false)
  })
})

describe('lineItemSchema', () => {
  const validLineItem = {
    description: 'Consulting',
    quantity: 10,
    unitAmount: 150,
    accountCode: '200',
    taxType: 'OUTPUT2',
  }

  it('accepts valid line items', () => {
    expect(lineItemSchema.safeParse(validLineItem).success).toBe(true)
  })

  it('accepts line items with optional fields', () => {
    expect(lineItemSchema.safeParse({...validLineItem, itemCode: 'CONS'}).success).toBe(true)
  })

  it('rejects missing description', () => {
    const {description: _, ...noDesc} = validLineItem
    expect(lineItemSchema.safeParse(noDesc).success).toBe(false)
  })

  it('rejects negative quantity', () => {
    expect(lineItemSchema.safeParse({...validLineItem, quantity: -1}).success).toBe(false)
  })

  it('rejects negative unit amount', () => {
    expect(lineItemSchema.safeParse({...validLineItem, unitAmount: -10}).success).toBe(false)
  })
})

describe('invoiceCreateSchema', () => {
  const validInvoice = {
    contactId: 'abc-123',
    type: 'ACCREC' as const,
    lineItems: [{
      description: 'Consulting',
      quantity: 10,
      unitAmount: 150,
      accountCode: '200',
      taxType: 'OUTPUT2',
    }],
  }

  it('accepts valid invoice', () => {
    expect(invoiceCreateSchema.safeParse(validInvoice).success).toBe(true)
  })

  it('accepts ACCPAY type', () => {
    expect(invoiceCreateSchema.safeParse({...validInvoice, type: 'ACCPAY'}).success).toBe(true)
  })

  it('rejects invalid type', () => {
    expect(invoiceCreateSchema.safeParse({...validInvoice, type: 'INVALID'}).success).toBe(false)
  })

  it('rejects empty line items', () => {
    expect(invoiceCreateSchema.safeParse({...validInvoice, lineItems: []}).success).toBe(false)
  })

  it('rejects missing contact ID', () => {
    const {contactId: _, ...noContact} = validInvoice
    expect(invoiceCreateSchema.safeParse(noContact).success).toBe(false)
  })

  it('accepts optional date and reference', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInvoice,
      date: '2025-06-15',
      reference: 'REF-001',
    })
    expect(result.success).toBe(true)
  })
})

describe('contactCreateSchema', () => {
  it('accepts name only', () => {
    expect(contactCreateSchema.safeParse({name: 'Acme Corp'}).success).toBe(true)
  })

  it('accepts name with email and phone', () => {
    expect(contactCreateSchema.safeParse({
      name: 'Acme Corp',
      email: 'info@acme.com',
      phone: '+1234567890',
    }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(contactCreateSchema.safeParse({name: ''}).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(contactCreateSchema.safeParse({name: 'Acme', email: 'not-an-email'}).success).toBe(false)
  })
})

describe('paymentCreateSchema', () => {
  it('accepts valid payment', () => {
    expect(paymentCreateSchema.safeParse({
      invoiceId: 'inv-123',
      accountId: 'acc-456',
      amount: 500,
    }).success).toBe(true)
  })

  it('rejects zero amount', () => {
    expect(paymentCreateSchema.safeParse({
      invoiceId: 'inv-123',
      accountId: 'acc-456',
      amount: 0,
    }).success).toBe(false)
  })

  it('rejects negative amount', () => {
    expect(paymentCreateSchema.safeParse({
      invoiceId: 'inv-123',
      accountId: 'acc-456',
      amount: -100,
    }).success).toBe(false)
  })
})

describe('journalCreateSchema', () => {
  it('accepts valid journal with balanced lines', () => {
    expect(journalCreateSchema.safeParse({
      narration: 'Test journal',
      manualJournalLines: [
        {accountCode: '200', lineAmount: 100},
        {accountCode: '400', lineAmount: -100},
      ],
    }).success).toBe(true)
  })

  it('rejects fewer than 2 lines', () => {
    expect(journalCreateSchema.safeParse({
      narration: 'Test journal',
      manualJournalLines: [
        {accountCode: '200', lineAmount: 100},
      ],
    }).success).toBe(false)
  })

  it('rejects empty narration', () => {
    expect(journalCreateSchema.safeParse({
      narration: '',
      manualJournalLines: [
        {accountCode: '200', lineAmount: 100},
        {accountCode: '400', lineAmount: -100},
      ],
    }).success).toBe(false)
  })
})

describe('formatZodError', () => {
  it('formats validation errors', () => {
    const result = contactCreateSchema.safeParse({name: '', email: 'bad'})
    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatZodError(result.error)
      expect(formatted).toContain('name')
      expect(formatted).toContain('email')
    }
  })
})
