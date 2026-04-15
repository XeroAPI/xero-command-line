#!/usr/bin/env bun
/**
 * Bun binary entry point.
 *
 * Bun compiled binaries can't satisfy bare-specifier imports (e.g. @oclif/core)
 * for files loaded dynamically from the filesystem.  Oclif normally discovers
 * commands by doing runtime import() calls on the compiled dist/ files, which
 * then re-import @oclif/core – and that fails inside a container that has no
 * node_modules directory.
 *
 * Fix: statically import every command class here so Bun bundles them into the
 * binary.  Then, after oclif has loaded its Config (which sets up lazy loaders
 * pointing at the dist/ files), we replace each lazy loader with one that
 * returns the already-bundled class.  This way no command class is ever loaded
 * from the filesystem at runtime.
 */

import { Config, handle, run } from '@oclif/core'

// ── Commands ─────────────────────────────────────────────────────────────────
import AccountsAttachmentsDownload from '../src/commands/accounts/attachments/download.js'
import AccountsAttachmentsList from '../src/commands/accounts/attachments/list.js'
import AccountsAttachmentsUpload from '../src/commands/accounts/attachments/upload.js'
import AccountsList from '../src/commands/accounts/list.js'
import AccountsUpdate from '../src/commands/accounts/update.js'
import BankTransactionsAttachmentsDownload from '../src/commands/bank-transactions/attachments/download.js'
import BankTransactionsAttachmentsList from '../src/commands/bank-transactions/attachments/list.js'
import BankTransactionsAttachmentsUpload from '../src/commands/bank-transactions/attachments/upload.js'
import BankTransactionsCreate from '../src/commands/bank-transactions/create.js'
import BankTransactionsList from '../src/commands/bank-transactions/list.js'
import BankTransactionsUpdate from '../src/commands/bank-transactions/update.js'
import ContactGroupsList from '../src/commands/contact-groups/list.js'
import ContactsAttachmentsDownload from '../src/commands/contacts/attachments/download.js'
import ContactsAttachmentsList from '../src/commands/contacts/attachments/list.js'
import ContactsAttachmentsUpload from '../src/commands/contacts/attachments/upload.js'
import ContactsCreate from '../src/commands/contacts/create.js'
import ContactsList from '../src/commands/contacts/list.js'
import ContactsUpdate from '../src/commands/contacts/update.js'
import CreditNotesAttachmentsDownload from '../src/commands/credit-notes/attachments/download.js'
import CreditNotesAttachmentsList from '../src/commands/credit-notes/attachments/list.js'
import CreditNotesAttachmentsUpload from '../src/commands/credit-notes/attachments/upload.js'
import CreditNotesCreate from '../src/commands/credit-notes/create.js'
import CreditNotesList from '../src/commands/credit-notes/list.js'
import CreditNotesUpdate from '../src/commands/credit-notes/update.js'
import CurrenciesList from '../src/commands/currencies/list.js'
import InvoicesAttachmentsDownload from '../src/commands/invoices/attachments/download.js'
import InvoicesAttachmentsList from '../src/commands/invoices/attachments/list.js'
import InvoicesAttachmentsUpload from '../src/commands/invoices/attachments/upload.js'
import InvoicesCreate from '../src/commands/invoices/create.js'
import InvoicesList from '../src/commands/invoices/list.js'
import InvoicesUpdate from '../src/commands/invoices/update.js'
import ItemsCreate from '../src/commands/items/create.js'
import ItemsList from '../src/commands/items/list.js'
import ItemsUpdate from '../src/commands/items/update.js'
import Login from '../src/commands/login.js'
import Logout from '../src/commands/logout.js'
import ManualJournalsAttachmentsDownload from '../src/commands/manual-journals/attachments/download.js'
import ManualJournalsAttachmentsList from '../src/commands/manual-journals/attachments/list.js'
import ManualJournalsAttachmentsUpload from '../src/commands/manual-journals/attachments/upload.js'
import ManualJournalsCreate from '../src/commands/manual-journals/create.js'
import ManualJournalsList from '../src/commands/manual-journals/list.js'
import ManualJournalsUpdate from '../src/commands/manual-journals/update.js'
import OrgDetails from '../src/commands/org/details.js'
import PaymentsCreate from '../src/commands/payments/create.js'
import PaymentsList from '../src/commands/payments/list.js'
import ProfileAdd from '../src/commands/profile/add.js'
import ProfileList from '../src/commands/profile/list.js'
import ProfileRemove from '../src/commands/profile/remove.js'
import ProfileSetDefault from '../src/commands/profile/set-default.js'
import QuotesAttachmentsDownload from '../src/commands/quotes/attachments/download.js'
import QuotesAttachmentsList from '../src/commands/quotes/attachments/list.js'
import QuotesAttachmentsUpload from '../src/commands/quotes/attachments/upload.js'
import QuotesCreate from '../src/commands/quotes/create.js'
import QuotesList from '../src/commands/quotes/list.js'
import QuotesUpdate from '../src/commands/quotes/update.js'
import ReportsAgedPayables from '../src/commands/reports/aged-payables.js'
import ReportsAgedReceivables from '../src/commands/reports/aged-receivables.js'
import ReportsBalanceSheet from '../src/commands/reports/balance-sheet.js'
import ReportsProfitAndLoss from '../src/commands/reports/profit-and-loss.js'
import ReportsTrialBalance from '../src/commands/reports/trial-balance.js'
import TaxRatesList from '../src/commands/tax-rates/list.js'
import TrackingCategoriesCreate from '../src/commands/tracking/categories/create.js'
import TrackingCategoriesList from '../src/commands/tracking/categories/list.js'
import TrackingCategoriesUpdate from '../src/commands/tracking/categories/update.js'
import TrackingOptionsCreate from '../src/commands/tracking/options/create.js'
import TrackingOptionsUpdate from '../src/commands/tracking/options/update.js'

// ── Command registry (oclif ID → bundled class) ───────────────────────────────
// IDs must match what oclif.manifest.json uses (colon-separated topics).
const BUNDLED_COMMANDS: Record<string, unknown> = {
  'accounts:attachments:download': AccountsAttachmentsDownload,
  'accounts:attachments:list': AccountsAttachmentsList,
  'accounts:attachments:upload': AccountsAttachmentsUpload,
  'accounts:list': AccountsList,
  'accounts:update': AccountsUpdate,
  'bank-transactions:attachments:download': BankTransactionsAttachmentsDownload,
  'bank-transactions:attachments:list': BankTransactionsAttachmentsList,
  'bank-transactions:attachments:upload': BankTransactionsAttachmentsUpload,
  'bank-transactions:create': BankTransactionsCreate,
  'bank-transactions:list': BankTransactionsList,
  'bank-transactions:update': BankTransactionsUpdate,
  'contact-groups:list': ContactGroupsList,
  'contacts:attachments:download': ContactsAttachmentsDownload,
  'contacts:attachments:list': ContactsAttachmentsList,
  'contacts:attachments:upload': ContactsAttachmentsUpload,
  'contacts:create': ContactsCreate,
  'contacts:list': ContactsList,
  'contacts:update': ContactsUpdate,
  'credit-notes:attachments:download': CreditNotesAttachmentsDownload,
  'credit-notes:attachments:list': CreditNotesAttachmentsList,
  'credit-notes:attachments:upload': CreditNotesAttachmentsUpload,
  'credit-notes:create': CreditNotesCreate,
  'credit-notes:list': CreditNotesList,
  'credit-notes:update': CreditNotesUpdate,
  'currencies:list': CurrenciesList,
  'invoices:attachments:download': InvoicesAttachmentsDownload,
  'invoices:attachments:list': InvoicesAttachmentsList,
  'invoices:attachments:upload': InvoicesAttachmentsUpload,
  'invoices:create': InvoicesCreate,
  'invoices:list': InvoicesList,
  'invoices:update': InvoicesUpdate,
  'items:create': ItemsCreate,
  'items:list': ItemsList,
  'items:update': ItemsUpdate,
  login: Login,
  logout: Logout,
  'manual-journals:attachments:download': ManualJournalsAttachmentsDownload,
  'manual-journals:attachments:list': ManualJournalsAttachmentsList,
  'manual-journals:attachments:upload': ManualJournalsAttachmentsUpload,
  'manual-journals:create': ManualJournalsCreate,
  'manual-journals:list': ManualJournalsList,
  'manual-journals:update': ManualJournalsUpdate,
  'org:details': OrgDetails,
  'payments:create': PaymentsCreate,
  'payments:list': PaymentsList,
  'profile:add': ProfileAdd,
  'profile:list': ProfileList,
  'profile:remove': ProfileRemove,
  'profile:set-default': ProfileSetDefault,
  'quotes:attachments:download': QuotesAttachmentsDownload,
  'quotes:attachments:list': QuotesAttachmentsList,
  'quotes:attachments:upload': QuotesAttachmentsUpload,
  'quotes:create': QuotesCreate,
  'quotes:list': QuotesList,
  'quotes:update': QuotesUpdate,
  'reports:aged-payables': ReportsAgedPayables,
  'reports:aged-receivables': ReportsAgedReceivables,
  'reports:balance-sheet': ReportsBalanceSheet,
  'reports:profit-and-loss': ReportsProfitAndLoss,
  'reports:trial-balance': ReportsTrialBalance,
  'tax-rates:list': TaxRatesList,
  'tracking:categories:create': TrackingCategoriesCreate,
  'tracking:categories:list': TrackingCategoriesList,
  'tracking:categories:update': TrackingCategoriesUpdate,
  'tracking:options:create': TrackingOptionsCreate,
  'tracking:options:update': TrackingOptionsUpdate,
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Load oclif config (reads package.json + oclif.manifest.json from the
// filesystem directory that contains the binary).
const config = await Config.load(import.meta.url)

// Patch every command's lazy loader to return the class bundled into this
// binary instead of doing a dynamic filesystem import.
const commandsMap = (config as Record<string, unknown>)._commands as Map<string, Record<string, unknown>>
for (const [id, cmd] of commandsMap) {
  const bundledClass = BUNDLED_COMMANDS[id]
  if (bundledClass) {
    commandsMap.set(id, { ...cmd, load: async () => bundledClass })
  }
}

await run(process.argv.slice(2), config).catch(handle)
