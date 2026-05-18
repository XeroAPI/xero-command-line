/**
 * Utility for normalizing file data for API consumption.
 * Handles flexible casing (camelCase vs PascalCase) for ID fields
 * that the Xero API uses (e.g., contactID vs contactId).
 */

type FileData = Record<string, unknown>

/**
 * Extracts a contact ID from file data, accepting multiple casing conventions.
 * Looks for: contactID, contactId, or contact.contactID
 */
export function extractContactId(data: FileData): string | undefined {
  if (typeof data.contactID === 'string') return data.contactID
  if (typeof data.contactId === 'string') return data.contactId
  const contact = data.contact as FileData | undefined
  if (contact && typeof contact.contactID === 'string') return contact.contactID
  return undefined
}

/**
 * Extracts an invoice ID from file data, accepting multiple casing conventions.
 */
export function extractInvoiceId(data: FileData): string | undefined {
  if (typeof data.invoiceID === 'string') return data.invoiceID
  if (typeof data.invoiceId === 'string') return data.invoiceId
  const invoice = data.invoice as FileData | undefined
  if (invoice && typeof invoice.invoiceID === 'string') return invoice.invoiceID
  return undefined
}

/**
 * Extracts an account ID from file data, accepting multiple casing conventions.
 */
export function extractAccountId(data: FileData): string | undefined {
  if (typeof data.accountID === 'string') return data.accountID
  if (typeof data.accountId === 'string') return data.accountId
  const account = data.account as FileData | undefined
  if (account && typeof account.accountID === 'string') return account.accountID
  return undefined
}

/**
 * Ensures the file data has a contact nested object for the API.
 * If contactId/contactID is at top level, wraps it in { contact: { contactID } }.
 */
export function ensureContactNested(data: FileData): FileData {
  if (data.contact) return data
  const contactId = extractContactId(data)
  if (contactId) {
    const {contactID: _a, contactId: _b, ...rest} = data
    return {...rest, contact: {contactID: contactId}}
  }
  return data
}

/**
 * Ensures the file data has an invoice nested object for the API.
 */
export function ensureInvoiceNested(data: FileData): FileData {
  if (data.invoice) return data
  const invoiceId = extractInvoiceId(data)
  if (invoiceId) {
    const {invoiceID: _a, invoiceId: _b, ...rest} = data
    return {...rest, invoice: {invoiceID: invoiceId}}
  }
  return data
}

/**
 * Ensures the file data has an account nested object for the API.
 */
export function ensureAccountNested(data: FileData): FileData {
  if (data.account) return data
  const accountId = extractAccountId(data)
  if (accountId) {
    const {accountID: _a, accountId: _b, ...rest} = data
    return {...rest, account: {accountID: accountId}}
  }
  return data
}

/**
 * Ensures the file data has a bankAccount nested object for the API.
 */
export function ensureBankAccountNested(data: FileData): FileData {
  if (data.bankAccount) return data
  const id = (data.bankAccountId ?? data.bankAccountID) as string | undefined
  if (id) {
    const {bankAccountId: _a, bankAccountID: _b, ...rest} = data
    return {...rest, bankAccount: {accountID: id}}
  }
  return data
}
