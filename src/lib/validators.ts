import {z} from 'zod'

export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    if (year < 1) return false
    const candidate = new Date(0)
    candidate.setUTCHours(0, 0, 0, 0)
    candidate.setUTCFullYear(year, month - 1, day)
    return candidate.getUTCFullYear() === year
      && candidate.getUTCMonth() === month - 1
      && candidate.getUTCDate() === day
  }, 'Date must be a real calendar date')

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
  date: z.string().optional(),
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
  lineAmount: z.number().finite('Line amount must be finite'),
  description: z.string().optional(),
  taxType: z.string().optional(),
})

function amountToMinorUnits(amount: number): bigint | null {
  if (!Number.isFinite(amount)) return null
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(amount))
  if (!match) return null
  const [, sign, integer, fraction = '', exponentText = '0'] = match
  const digits = BigInt(`${integer}${fraction}`)
  const power = Number(exponentText) - fraction.length + 2
  if (!Number.isSafeInteger(power)) return null

  let minorUnits: bigint
  if (power >= 0) {
    minorUnits = digits * 10n ** BigInt(power)
  } else {
    const divisor = 10n ** BigInt(-power)
    if (digits % divisor !== 0n) return null
    minorUnits = digits / divisor
  }
  return sign === '-' ? -minorUnits : minorUnits
}

function journalLinesAreBalanced(lines: Array<{lineAmount: number}>): boolean {
  const amounts = lines.map((line) => amountToMinorUnits(line.lineAmount))
  return amounts.every((amount): amount is bigint => amount !== null)
    && amounts.reduce((total, amount) => total + amount, 0n) === 0n
}

function addJournalBalanceIssue(
  lines: Array<{lineAmount: number}>,
  ctx: z.RefinementCtx,
  path: string,
): void {
  if (!journalLinesAreBalanced(lines)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Journal lines must use exact cents and balance to zero',
      path: [path],
    })
  }
}

export const journalCreateSchema = z.object({
  narration: z.string().min(1, 'Narration is required'),
  manualJournalLines: z.array(journalLineSchema).min(2, 'At least two journal lines are required'),
  date: dateSchema.optional(),
  lineAmountTypes: z.enum(['EXCLUSIVE', 'INCLUSIVE', 'NO_TAX']).optional(),
  status: z.literal('DRAFT').default('DRAFT'),
  url: z.string().url().optional(),
  showOnCashBasisReports: z.boolean().optional(),
}).superRefine((journal, ctx) => addJournalBalanceIssue(journal.manualJournalLines, ctx, 'manualJournalLines'))

export const journalUpdateSchema = z.object({
  manualJournalID: z.string().min(1, 'Manual journal ID is required'),
  narration: z.string().min(1, 'Narration is required'),
  manualJournalLines: z.array(journalLineSchema).min(2, 'At least two journal lines are required'),
  date: dateSchema.optional(),
  lineAmountTypes: z.enum(['EXCLUSIVE', 'INCLUSIVE', 'NO_TAX']).optional(),
  status: z.literal('DRAFT').optional(),
  url: z.string().url().optional(),
  showOnCashBasisReports: z.boolean().optional(),
}).superRefine((journal, ctx) => addJournalBalanceIssue(journal.manualJournalLines, ctx, 'manualJournalLines'))

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

export const accountUpdateSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  taxType: z.string().optional(),
  enablePaymentsToAccount: z.boolean().optional(),
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

// File-mode passthrough schemas: validate only minimum required fields,
// then forward the entire file payload untouched to the Xero API.
export const contactFileCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
}).passthrough()

export const contactFileUpdateSchema = z.object({
  contactID: z.string().min(1, 'Contact ID is required'),
}).passthrough()

export const invoiceFileCreateSchema = z.object({
  type: z.enum(['ACCREC', 'ACCPAY']),
  lineItems: z.array(z.object({}).passthrough()).min(1, 'At least one line item is required'),
}).passthrough()

export const invoiceFileUpdateSchema = z.object({
  invoiceID: z.string().min(1, 'Invoice ID is required'),
}).passthrough()

export const quoteFileCreateSchema = z.object({
  lineItems: z.array(z.object({}).passthrough()).min(1, 'At least one line item is required'),
}).passthrough()

export const quoteFileUpdateSchema = z.object({
  quoteID: z.string().min(1, 'Quote ID is required'),
}).passthrough()

export const bankTransactionFileCreateSchema = z.object({
  type: z.enum(['RECEIVE', 'SPEND']),
  lineItems: z.array(z.object({}).passthrough()).min(1, 'At least one line item is required'),
}).passthrough()

export const bankTransactionFileUpdateSchema = z.object({
  bankTransactionID: z.string().min(1, 'Bank transaction ID is required'),
}).passthrough()

export const creditNoteFileCreateSchema = z.object({
  lineItems: z.array(z.object({}).passthrough()).min(1, 'At least one line item is required'),
}).passthrough()

export const creditNoteFileUpdateSchema = z.object({
  creditNoteID: z.string().min(1, 'Credit note ID is required'),
}).passthrough()

export const paymentFileCreateSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
}).passthrough()

export const itemFileCreateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
}).passthrough()

export const itemFileUpdateSchema = z.object({
  itemID: z.string().min(1, 'Item ID is required'),
}).passthrough()

export const accountFileUpdateSchema = z.object({
  accountID: z.string().min(1, 'Account ID is required'),
}).passthrough()

const journalFileLineSchema = z.object({
  lineAmount: z.number().finite('Line amount must be finite'),
}).passthrough()

export const journalFileCreateSchema = z.object({
  narration: z.string().min(1, 'Narration is required'),
  journalLines: z.array(journalFileLineSchema).min(2, 'At least two journal lines are required'),
  status: z.literal('DRAFT').default('DRAFT'),
}).passthrough().superRefine((journal, ctx) => addJournalBalanceIssue(journal.journalLines, ctx, 'journalLines'))

export const journalFileUpdateSchema = z.object({
  manualJournalID: z.string().min(1, 'Manual journal ID is required'),
  narration: z.string().min(1, 'Narration is required'),
  journalLines: z.array(journalFileLineSchema).min(2, 'At least two journal lines are required'),
  status: z.literal('DRAFT').optional(),
}).passthrough().superRefine((journal, ctx) => addJournalBalanceIssue(journal.journalLines, ctx, 'journalLines'))

export const trackingOptionsFileUpdateSchema = z.object({
  trackingCategoryId: z.string().min(1, 'Tracking category ID is required'),
  options: z.array(z.object({
    trackingOptionId: z.string().min(1),
  }).passthrough()).min(1).max(10),
}).passthrough()

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
}
