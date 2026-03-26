---
name: xero_command_line
description: Interact with the Xero accounting API using the `xero` CLI tool. Manage contacts, invoices, quotes, credit notes, payments, bank transactions, items, manual journals, tracking categories, tax rates, reports, and organisation details.
user-invocable: true
metadata:
  openclaw:
    requires:
      bins:
        - xero
      install: "npm install -g @xeroapi/xero-command-line"
    keywords:
      - accounting
      - xero
      - invoices
      - bookkeeping
      - finance
---

# xero CLI

You have access to the `xero` CLI — a command-line tool for the Xero accounting API using PKCE OAuth. Use it to read and write accounting data in the user's Xero organisation.

## Authentication & Setup

**Note for Agent:** If the user is not logged in, you must instruct them to run `xero login` in their terminal manually, as it requires a browser-based OAuth flow that you cannot complete.

```bash
# Check if logged in / check organization details
xero org details
```

## Global flags

Every API command supports these flags:

| Flag | Description |
|---|---|
| `-p, --profile <name>` | Use a specific named profile (defaults to the default profile) |
| `--client-id <id>` | Override the profile with an inline OAuth client ID |
| `--json` | Output raw JSON (useful for piping to `jq` or further processing) |
| `--csv` | Output as CSV |

Environment variables `XERO_PROFILE` and `XERO_CLIENT_ID` are also recognised.

## Auth & profiles

```bash
# Log in (opens browser for OAuth consent)
xero login
xero login -p my-profile

# Log out
xero logout

# Manage profiles (each profile maps to a Xero OAuth app / organisation)
xero profile add <name>                    # prompts for Client ID
xero profile add <name> --client-id <id>   # inline
xero profile list
xero profile set-default <name>
xero profile remove <name>
```

## Key workflow: find IDs first

Most create/update commands need Xero GUIDs. Always list first to find IDs:

```bash
xero contacts list --search "Acme"    # find a contact ID
xero accounts list                    # find account codes
xero invoices list                    # find invoice IDs
xero items list                       # find item codes
```

## JSON file input

Any create or update command accepts `--file <path.json>` instead of inline flags. Use this for multi-line-item resources. All inputs are validated before being sent to the API.

```bash
xero invoices create --file invoice.json
xero contacts update --file contact-update.json
```

## Commands

### Contacts

```bash
xero contacts list
xero contacts list --search "Acme" --page 2
xero contacts create --name "Acme Corp" --email acme@example.com --phone "+1234567890"
xero contacts create --file contact.json
xero contacts update --contact-id <ID> --name "Acme Corporation" --email new@acme.com
xero contacts update --file contact-update.json
```

### Contact Groups

```bash
xero contact-groups list
xero contact-groups list --group-id <ID>
```

### Accounts

```bash
xero accounts list
xero accounts list --json
```

### Invoices

```bash
xero invoices list
xero invoices list --contact-id <ID>
xero invoices list --invoice-number INV-0001
xero invoices list --page 2

# Single line item inline
xero invoices create --contact-id <ID> --type ACCREC \
  --description "Consulting" --quantity 10 --unit-amount 150 \
  --account-code 200 --tax-type OUTPUT2

# Multiple line items via JSON file
xero invoices create --file invoice.json

# Update a draft invoice
xero invoices update --invoice-id <ID> --reference "Updated ref"
xero invoices update --file invoice-update.json
```

Invoice types: `ACCREC` (sales/receivable), `ACCPAY` (purchase/payable).

Example invoice.json:
```json
{
  "contactId": "<CONTACT_ID>",
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
    }
  ]
}
```

### Quotes

```bash
xero quotes list
xero quotes list --contact-id <ID>
xero quotes list --quote-number QU-0001

xero quotes create --contact-id <ID> --title "Project Quote" \
  --date 2025-12-30 --description "Web design" --quantity 1 --unit-amount 5000 \
  --account-code 200 --tax-type OUTPUT2
xero quotes create --file quote.json

xero quotes update --file quote-update.json
```

> **Note:** Xero's API requires `contact` and `date` on quote updates even though the CLI allows them to be omitted. If you get a validation error, ensure your update payload includes both fields.

### Credit Notes

```bash
xero credit-notes list
xero credit-notes list --contact-id <ID> --page 2

xero credit-notes create --contact-id <ID> \
  --description "Refund" --quantity 1 --unit-amount 100 \
  --account-code 200 --tax-type OUTPUT2
xero credit-notes create --file credit-note.json

xero credit-notes update --file credit-note-update.json
```

### Manual Journals

Manual journals require at least two journal lines (debit + credit). Always use `--file`.

```bash
xero manual-journals list
xero manual-journals list --manual-journal-id <ID>
xero manual-journals list --modified-after 2025-01-01

xero manual-journals create --file journal.json
xero manual-journals update --file journal-update.json
```

Example journal.json:
```json
{
  "narration": "Reclassify office supplies",
  "manualJournalLines": [
    { "accountCode": "200", "lineAmount": 100, "description": "Debit" },
    { "accountCode": "400", "lineAmount": -100, "description": "Credit" }
  ]
}
```

### Bank Transactions

```bash
xero bank-transactions list
xero bank-transactions list --bank-account-id <ID>

xero bank-transactions create --type SPEND --bank-account-id <BANK_ID> \
  --contact-id <CONTACT_ID> --description "Office supplies" \
  --quantity 1 --unit-amount 50 --account-code 429 --tax-type INPUT2
xero bank-transactions create --file bank-transaction.json

xero bank-transactions update --file bank-transaction-update.json
```

Transaction types: `RECEIVE` (money in), `SPEND` (money out).

### Payments

```bash
xero payments list
xero payments list --invoice-id <ID>
xero payments list --invoice-number INV-0001
xero payments list --reference "Payment ref"

xero payments create --invoice-id <ID> --account-id <ACCOUNT_ID> --amount 500
xero payments create --file payment.json
```

### Items

```bash
xero items list
xero items list --page 2

xero items create --code WIDGET --name "Widget" --sale-price 29.99
xero items create --file item.json

xero items update --item-id <ID> --code WIDGET --name "Updated Widget"
xero items update --file item-update.json
```

### Tax Rates

```bash
xero tax-rates list
xero tax-rates list --json
```

### Tracking Categories & Options

```bash
xero tracking categories list
xero tracking categories list --include-archived

xero tracking categories create --name "Department"
xero tracking categories update --category-id <ID> --name "Region"
xero tracking categories update --category-id <ID> --status ARCHIVED

xero tracking options create --category-id <ID> --names "Sales,Marketing,Engineering"
xero tracking options update --category-id <ID> --file tracking-options.json
```

### Organisation

```bash
xero org details
xero org details --json
```

### Reports

```bash
# Trial balance
xero reports trial-balance
xero reports trial-balance --date 2025-12-31

# Profit and loss
xero reports profit-and-loss
xero reports profit-and-loss --from 2025-01-01 --to 2025-12-31
xero reports profit-and-loss --timeframe QUARTER --periods 4

# Balance sheet
xero reports balance-sheet
xero reports balance-sheet --date 2025-12-31
xero reports balance-sheet --timeframe MONTH --periods 12

# Aged receivables (requires contact ID)
xero reports aged-receivables --contact-id <ID>
xero reports aged-receivables --contact-id <ID> --report-date 2025-12-31

# Aged payables (requires contact ID)
xero reports aged-payables --contact-id <ID>
xero reports aged-payables --contact-id <ID> --from-date 2025-01-01 --to-date 2025-12-31
```

## Tips

- Use `--json` and pipe to `jq` when you need to extract specific fields programmatically.
- Only draft invoices, quotes, and credit notes can be updated.
- For multi-line-item creates, always use `--file` with a JSON payload.
- Tax types vary by region. Run `xero tax-rates list` to see what's available.
- Account codes are needed for line items. Run `xero accounts list` to find them.
