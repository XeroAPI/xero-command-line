# xero-command-line

A command-line tool for the Xero API using PKCE OAuth. Authenticates via browser-based login — no client secret required. Supports multiple Xero organisations via named profiles.

> **Alpha** (v0.0.1) — APIs may change.

## Install

```bash
npm install -g @xeroapi/xero-command-line
```

Or try it without installing:

```bash
npx @xeroapi/xero-command-line <command>
```

### From source

```bash
git clone https://github.com/XeroAPI/xero-command-line.git
cd xero-command-line
npm install
npm run build
npm link
```

### Prerequisites

- Node.js >= 18
- A Xero OAuth 2.0 app at [developer.xero.com](https://developer.xero.com/app/manage) (no client secret needed — PKCE handles authentication)
- Set the redirect URI on your OAuth 2.0 PKCE app to `http://localhost:8742/callback`

## Setup

1. **Create a profile** with your Xero app's Client ID:

```bash
xero profile add my-company
# Prompts for Client ID
```

Or pass it inline:

```bash
xero profile add my-company --client-id YOUR_CLIENT_ID
```

2. **Log in** via the browser:

```bash
xero login
```

This opens your browser for Xero's OAuth consent flow. After you authorize, the CLI receives tokens via a local callback server. If your app is connected to multiple organisations, you'll be prompted to select one.

Tokens are encrypted (AES-256-GCM) and cached at `~/.config/xero-command-line/tokens.json`. The encryption key is stored in the OS keychain. Tokens refresh automatically when expired.

## Global Flags

Every command that calls the Xero API supports:

| Flag | Description |
|---|---|
| `-p, --profile <name>` | Use a specific profile (defaults to the default profile) |
| `--client-id <id>` | Override profile with an inline client ID |
| `--json` | Output raw JSON (for piping/scripting) |
| `--csv` | Output as CSV |

Environment variables `XERO_PROFILE` and `XERO_CLIENT_ID` are also supported.

## Finding IDs

Most commands that reference contacts, invoices, or accounts require a Xero GUID (e.g., `edc74793-8d7e-4bf2-9e63-146dc4c675a2`). Use the list commands to find IDs:

```bash
xero contacts list --search "Acme"   # find a contact ID
xero accounts list                    # find account codes
xero invoices list                    # find invoice IDs
```

## Commands

### Profile Management

```bash
# Add a profile (first profile becomes the default)
xero profile add acme-corp

# List all profiles
xero profile list

# Set the default profile
xero profile set-default acme-corp

# Remove a profile
xero profile remove acme-corp
```

### Organisation

```bash
xero org details
xero org details --json
```

### Contacts

```bash
# List contacts
xero contacts list
xero contacts list --search "Acme"
xero contacts list --page 2 --json

# Create a contact
xero contacts create --name "Acme Corp" --email acme@example.com --phone "+1234567890"
xero contacts create --file contact.json

# Update a contact
xero contacts update --contact-id 00000000-0000-0000-0000-000000000001 --name "Acme Corporation" --email new@acme.com
xero contacts update --file contact-update.json
```

### Contact Groups

```bash
xero contact-groups list
xero contact-groups list --group-id 00000000-0000-0000-0000-000000000001
```

### Accounts

```bash
xero accounts list
xero accounts list --json
```

### Invoices

```bash
# List invoices
xero invoices list
xero invoices list --contact-id 00000000-0000-0000-0000-000000000001
xero invoices list --invoice-number INV-0001
xero invoices list --page 2 --csv

# Create an invoice (inline flags for a single line item)
xero invoices create --contact-id 00000000-0000-0000-0000-000000000001 --type ACCREC \
  --description "Consulting" --quantity 10 --unit-amount 150 \
  --account-code 200 --tax-type OUTPUT2

# Create an invoice (JSON file for multiple line items)
xero invoices create --file invoice.json

# Update a draft invoice
xero invoices update --invoice-id 00000000-0000-0000-0000-000000000001 --reference "Updated ref"
xero invoices update --file invoice-update.json
```

<details>
<summary>Example invoice.json</summary>

```json
{
  "contactId": "00000000-0000-0000-0000-000000000001",
  "type": "ACCREC",
  "date": "2025-06-15",
  "reference": "REF-001",
  "lineItems": [
    {
      "description": "Consulting",
      "quantity": 10,
      "unitAmount": 150,
      "accountCode": "200",
      "taxType": "OUTPUT2"
    },
    {
      "description": "Travel",
      "quantity": 1,
      "unitAmount": 500,
      "accountCode": "200",
      "taxType": "OUTPUT2"
    }
  ]
}
```

</details>

### Quotes

```bash
# List quotes
xero quotes list
xero quotes list --contact-id 00000000-0000-0000-0000-000000000001
xero quotes list --quote-number QU-0001

# Create a quote
xero quotes create --file quote.json
xero quotes create --contact-id 00000000-0000-0000-0000-000000000001 --title "Project Quote" \
  --date 2025-12-30 --description "Web design" --quantity 1 --unit-amount 5000 \
  --account-code 200 --tax-type OUTPUT2

# Update a draft quote
xero quotes update --file quote-update.json
```

### Credit Notes

```bash
# List credit notes
xero credit-notes list
xero credit-notes list --contact-id 00000000-0000-0000-0000-000000000001 --page 2

# Create a credit note
xero credit-notes create --file credit-note.json
xero credit-notes create --contact-id 00000000-0000-0000-0000-000000000001 \
  --description "Refund" --quantity 1 --unit-amount 100 \
  --account-code 200 --tax-type OUTPUT2

# Update a draft credit note
xero credit-notes update --file credit-note-update.json
```

### Manual Journals

```bash
# List manual journals
xero manual-journals list
xero manual-journals list --manual-journal-id 00000000-0000-0000-0000-000000000001
xero manual-journals list --modified-after 2025-01-01

# Create a manual journal (requires JSON file — minimum 2 lines)
xero manual-journals create --file journal.json

# Update a draft manual journal
xero manual-journals update --file journal-update.json
```

<details>
<summary>Example journal.json</summary>

```json
{
  "narration": "Reclassify office supplies",
  "manualJournalLines": [
    { "accountCode": "200", "lineAmount": 100, "description": "Debit" },
    { "accountCode": "400", "lineAmount": -100, "description": "Credit" }
  ]
}
```

</details>

### Bank Transactions

```bash
# List bank transactions
xero bank-transactions list
xero bank-transactions list --bank-account-id 00000000-0000-0000-0000-000000000001

# Create a bank transaction
xero bank-transactions create --file bank-transaction.json
xero bank-transactions create --type SPEND --bank-account-id 00000000-0000-0000-0000-000000000001 \
  --contact-id 00000000-0000-0000-0000-000000000002 --description "Office supplies" \
  --quantity 1 --unit-amount 50 --account-code 429 --tax-type INPUT2

# Update a bank transaction
xero bank-transactions update --file bank-transaction-update.json
```

### Payments

```bash
# List payments
xero payments list
xero payments list --invoice-id 00000000-0000-0000-0000-000000000001
xero payments list --invoice-number INV-0001
xero payments list --reference "Payment ref"

# Create a payment
xero payments create --invoice-id 00000000-0000-0000-0000-000000000001 --account-id 00000000-0000-0000-0000-000000000002 --amount 500
xero payments create --file payment.json
```

### Items

```bash
# List items
xero items list
xero items list --page 2

# Create an item
xero items create --code WIDGET --name "Widget" --sale-price 29.99
xero items create --file item.json

# Update an item
xero items update --item-id 00000000-0000-0000-0000-000000000001 --code WIDGET --name "Updated Widget"
xero items update --file item-update.json
```

### Tax Rates

```bash
xero tax-rates list
xero tax-rates list --json
```

### Tracking Categories & Options

```bash
# List tracking categories
xero tracking categories list
xero tracking categories list --include-archived

# Create a tracking category
xero tracking categories create --name "Department"

# Update a tracking category
xero tracking categories update --category-id 00000000-0000-0000-0000-000000000001 --name "Region"
xero tracking categories update --category-id 00000000-0000-0000-0000-000000000001 --status ARCHIVED

# Create tracking options
xero tracking options create --category-id 00000000-0000-0000-0000-000000000001 --names "Sales,Marketing,Engineering"

# Update tracking options
xero tracking options update --category-id 00000000-0000-0000-0000-000000000001 --file tracking-options.json
```

### Reports

```bash
# Trial balance
xero reports trial-balance
xero reports trial-balance --date 2025-12-31 --json

# Profit and loss
xero reports profit-and-loss
xero reports profit-and-loss --from 2025-01-01 --to 2025-12-31
xero reports profit-and-loss --timeframe QUARTER --periods 4

# Balance sheet
xero reports balance-sheet
xero reports balance-sheet --date 2025-12-31
xero reports balance-sheet --timeframe MONTH --periods 12

# Aged receivables (requires contact ID)
xero reports aged-receivables --contact-id 00000000-0000-0000-0000-000000000001
xero reports aged-receivables --contact-id 00000000-0000-0000-0000-000000000001 --report-date 2025-12-31

# Aged payables (requires contact ID)
xero reports aged-payables --contact-id 00000000-0000-0000-0000-000000000001
xero reports aged-payables --contact-id 00000000-0000-0000-0000-000000000001 --from-date 2025-01-01 --to-date 2025-12-31
```

## JSON File Input

Commands that create or update resources accept a `--file` flag with a JSON payload. All inputs are validated before being sent to the API. Validation errors are displayed with specific field-level messages.

```bash
xero invoices create --file invoice.json
```

## Output Formats

```bash
# Formatted table (default)
xero contacts list

# JSON (for piping to jq, scripts, etc.)
xero contacts list --json

# CSV (for spreadsheets)
xero contacts list --csv
```

## Multiple Organisations

Use profiles to manage multiple Xero orgs:

```bash
xero profile add client-a --client-id ID_A
xero profile add client-b --client-id ID_B

xero login -p client-a
xero login -p client-b

xero contacts list --profile client-a
xero invoices list --profile client-b
```

## Development

```bash
# Run in dev mode (no build step)
npm run dev -- contacts list

# Build
npm run build

# Run tests
npm test
npm run test:watch
```
