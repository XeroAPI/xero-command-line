import {z} from 'zod'

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

export const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitAmount: z.number().nonnegative('Unit amount must be non-negative'),
  accountCode: z.string().min(1, 'Account code is required'),
  taxType: z.string().min(1, 'Tax type is required'),
  itemCode: z.string().optional(),
  tracking: z.array(z.object({
    name: z.string(),
    option: z.string(),
    trackingCategoryID: z.string(),
  })).max(2).optional(),
})

export const invoiceCreateSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  type: z.enum(['ACCREC', 'ACCPAY']),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  date: dateSchema.optional(),
  reference: z.string().optional(),
})

export const invoiceUpdateSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  contactId: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  date: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  reference: z.string().optional(),
})

export const contactCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
})

export const contactUpdateSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address: z.object({
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
})

export const quoteCreateSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  title: z.string().optional(),
  summary: z.string().optional(),
  terms: z.string().optional(),
  reference: z.string().optional(),
  quoteNumber: z.string().optional(),
})

export const quoteUpdateSchema = z.object({
  quoteId: z.string().min(1, 'Quote ID is required'),
  contactId: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  terms: z.string().optional(),
  reference: z.string().optional(),
  quoteNumber: z.string().optional(),
  date: dateSchema.optional(),
  expiryDate: dateSchema.optional(),
})

export const creditNoteCreateSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  reference: z.string().optional(),
})

export const creditNoteUpdateSchema = z.object({
  creditNoteId: z.string().min(1, 'Credit note ID is required'),
  contactId: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  date: dateSchema.optional(),
  reference: z.string().optional(),
})

export const journalLineSchema = z.object({
  accountCode: z.string().min(1, 'Account code is required'),
  lineAmount: z.number(),
  description: z.string().optional(),
  taxType: z.string().optional(),
})

export const journalCreateSchema = z.object({
  narration: z.string().min(1, 'Narration is required'),
  manualJournalLines: z.array(journalLineSchema).min(2, 'At least two journal lines are required'),
  date: dateSchema.optional(),
  lineAmountTypes: z.enum(['EXCLUSIVE', 'INCLUSIVE', 'NO_TAX']).optional(),
  status: z.enum(['DRAFT', 'POSTED', 'DELETED', 'VOIDED', 'ARCHIVED']).optional(),
  url: z.string().url().optional(),
  showOnCashBasisReports: z.boolean().optional(),
})

export const journalUpdateSchema = z.object({
  manualJournalID: z.string().min(1, 'Manual journal ID is required'),
  narration: z.string().min(1, 'Narration is required'),
  manualJournalLines: z.array(journalLineSchema).min(2, 'At least two journal lines are required'),
  date: dateSchema.optional(),
  lineAmountTypes: z.enum(['EXCLUSIVE', 'INCLUSIVE', 'NO_TAX']).optional(),
  status: z.enum(['DRAFT', 'POSTED', 'DELETED', 'VOIDED', 'ARCHIVED']).optional(),
  url: z.string().url().optional(),
  showOnCashBasisReports: z.boolean().optional(),
})

export const bankTransactionCreateSchema = z.object({
  type: z.enum(['RECEIVE', 'SPEND']),
  bankAccountId: z.string().min(1, 'Bank account ID is required'),
  contactId: z.string().min(1, 'Contact ID is required'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  date: dateSchema.optional(),
  reference: z.string().optional(),
})

export const bankTransactionUpdateSchema = z.object({
  bankTransactionId: z.string().min(1, 'Bank transaction ID is required'),
  contactId: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  type: z.enum(['RECEIVE', 'SPEND']).optional(),
  date: dateSchema.optional(),
  reference: z.string().optional(),
})

export const paymentCreateSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  accountId: z.string().min(1, 'Account ID is required'),
  amount: z.number().positive('Amount must be positive'),
  date: dateSchema.optional(),
  reference: z.string().optional(),
})

export const itemCreateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  purchaseDescription: z.string().optional(),
  isTrackedAsInventory: z.boolean().optional(),
  inventoryAssetAccountCode: z.string().optional(),
  salesDetails: z.object({
    unitPrice: z.number(),
    accountCode: z.string().optional(),
    taxType: z.string().optional(),
  }).optional(),
  purchaseDetails: z.object({
    unitPrice: z.number(),
    accountCode: z.string().optional(),
    taxType: z.string().optional(),
  }).optional(),
})

export const itemUpdateSchema = itemCreateSchema.extend({
  itemId: z.string().min(1, 'Item ID is required'),
})

export const trackingCategoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export const trackingCategoryUpdateSchema = z.object({
  trackingCategoryId: z.string().min(1, 'Tracking category ID is required'),
  name: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
})

export const trackingOptionsCreateSchema = z.object({
  trackingCategoryId: z.string().min(1, 'Tracking category ID is required'),
  optionNames: z.array(z.string().min(1)).min(1).max(10),
})

export const trackingOptionsUpdateSchema = z.object({
  trackingCategoryId: z.string().min(1, 'Tracking category ID is required'),
  options: z.array(z.object({
    trackingOptionId: z.string().min(1),
    name: z.string().optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  })).min(1).max(10),
})

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
}
