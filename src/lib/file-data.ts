/**
 * Utility for normalizing file data for API consumption.
 * Handles flexible casing (camelCase vs PascalCase) for ID fields
 * that the Xero API uses (e.g., contactID vs contactId).
 */

type FileData = Record<string, unknown>

function isFileData(value: unknown): value is FileData {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeNestedId(
  data: FileData,
  nestedKey: string,
  camelCaseKey: string,
  apiKey: string,
): FileData | undefined {
  const nested = data[nestedKey]
  if (!nested) return undefined
  if (!isFileData(nested)) return data
  if (typeof nested[apiKey] === 'string') return data

  const id = nested[camelCaseKey]
  if (typeof id !== 'string') return data

  const normalized = {...nested, [apiKey]: id}
  delete normalized[camelCaseKey]
  return {...data, [nestedKey]: normalized}
}

/**
 * Extracts a contact ID from file data, accepting multiple casing conventions.
 * Looks for: contactID, contactId, contact.contactID, or contact.contactId
 */
export function extractContactId(data: FileData): string | undefined {
  if (typeof data.contactID === 'string') return data.contactID
  if (typeof data.contactId === 'string') return data.contactId
  const contact = data.contact
  if (isFileData(contact)) {
    if (typeof contact.contactID === 'string') return contact.contactID
    if (typeof contact.contactId === 'string') return contact.contactId
  }
  return undefined
}

/**
 * Extracts an invoice ID from file data, accepting multiple casing conventions.
 */
export function extractInvoiceId(data: FileData): string | undefined {
  if (typeof data.invoiceID === 'string') return data.invoiceID
  if (typeof data.invoiceId === 'string') return data.invoiceId
  const invoice = data.invoice
  if (isFileData(invoice)) {
    if (typeof invoice.invoiceID === 'string') return invoice.invoiceID
    if (typeof invoice.invoiceId === 'string') return invoice.invoiceId
  }
  return undefined
}

/**
 * Extracts an account ID from file data, accepting multiple casing conventions.
 */
export function extractAccountId(data: FileData): string | undefined {
  if (typeof data.accountID === 'string') return data.accountID
  if (typeof data.accountId === 'string') return data.accountId
  const account = data.account
  if (isFileData(account)) {
    if (typeof account.accountID === 'string') return account.accountID
    if (typeof account.accountId === 'string') return account.accountId
  }
  return undefined
}

/**
 * Ensures the file data has a contact nested object for the API.
 * If contactId/contactID is at top level, wraps it in { contact: { contactID } }.
 */
export function ensureContactNested(data: FileData): FileData {
  const normalized = normalizeNestedId(data, 'contact', 'contactId', 'contactID')
  if (normalized) return normalized
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
  const normalized = normalizeNestedId(data, 'invoice', 'invoiceId', 'invoiceID')
  if (normalized) return normalized
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
  const normalized = normalizeNestedId(data, 'account', 'accountId', 'accountID')
  if (normalized) return normalized
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
  const normalized = normalizeNestedId(data, 'bankAccount', 'accountId', 'accountID')
  if (normalized) return normalized
  const id = (data.bankAccountId ?? data.bankAccountID) as string | undefined
  if (id) {
    const {bankAccountId: _a, bankAccountID: _b, ...rest} = data
    return {...rest, bankAccount: {accountID: id}}
  }
  return data
}
