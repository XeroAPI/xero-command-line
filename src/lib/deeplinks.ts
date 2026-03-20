export const contactDeepLink = (shortCode: string, contactId: string) =>
  `https://go.xero.com/app/${shortCode}/contacts/contact/${contactId}`

export const invoiceDeepLink = (shortCode: string, invoiceId: string) =>
  `https://go.xero.com/app/${shortCode}/invoicing/view/${invoiceId}`

export const billDeepLink = (shortCode: string, billId: string) =>
  `https://go.xero.com/organisationlogin/default.aspx?shortcode=${shortCode}&redirecturl=/AccountsPayable/Edit.aspx?InvoiceID=${billId}`

export const creditNoteDeepLink = (shortCode: string, creditNoteId: string) =>
  `https://go.xero.com/organisationlogin/default.aspx?shortcode=${shortCode}&redirecturl=/AccountsPayable/ViewCreditNote.aspx?creditNoteID=${creditNoteId}`

export const quoteDeepLink = (shortCode: string, quoteId: string) =>
  `https://go.xero.com/app/${shortCode}/quotes/view/${quoteId}`

export const paymentDeepLink = (shortCode: string, paymentId: string) =>
  `https://go.xero.com/organisationlogin/default.aspx?shortcode=${shortCode}&redirecturl=/Bank/ViewTransaction.aspx?bankTransactionID=${paymentId}`

export const bankTransactionDeepLink = (shortCode: string, bankTransactionId: string) =>
  `https://go.xero.com/organisationlogin/default.aspx?shortcode=${shortCode}&redirecturl=/Bank/ViewTransaction.aspx?bankTransactionID=${bankTransactionId}`
