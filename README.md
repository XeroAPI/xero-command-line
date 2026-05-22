# xero-command-line

A command-line tool for the Xero API using PKCE OAuth. Authenticates via browser-based login — no client secret required. Supports multiple Xero organisations via named profiles.

> **Alpha** (v0.0.4) — APIs may change.

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

Tokens are encrypted (AES-256-GCM) and cached at `~/.config/xero-command-line/tokens.json`. Tokens refresh automatically when expired.

### Token storage

The CLI encrypts OAuth tokens at rest. Where the encryption key lives, from most to least secure:

1. **OS keychain (default)** — macOS Keychain, Windows Credential Manager, or Linux Secret Service (GNOME Keyring / KWallet via D-Bus). This is the recommended option on desktop systems.
2. **`XERO_TOKEN_PASSPHRASE`** — Derives the key with scrypt from your passphrase and a local salt file. The raw key is not stored on disk. Set the same value before `xero login` and every later command. Stronger than a file-stored key if you accept managing a secret env var.
3. **File backup (automatic in `auto` mode)** — When the keychain accepts a new key, a copy is also written to `~/.config/xero-command-line/.encryption-key` (mode `0600`). If a later command cannot read the keychain (common on **WSL**, **SSH**, or **headless** Linux), the CLI uses this file instead of failing or wiping tokens.
4. **`XERO_KEY_STORAGE=file`** — Use only the file key (skip the keychain). Useful on WSL when the secret service is unreliable; slightly weaker than keychain-only because any process running as your user can read the key file.

`XERO_KEY_STORAGE` values: `auto` (default), `keyring`, `file`.

On Linux, WSL, or SSH, if login works once and later commands say “Not logged in”, the secret service was likely unavailable in that shell. The CLI no longer deletes `tokens.json` on decrypt errors — you will get an explicit message instead.

**WSL / headless Linux (recommended keychain setup):**

```bash
sudo apt install -y gnome-keyring libsecret-1-0 libsecret-tools dbus-x11

# Add to ~/.bashrc or ~/.zshrc:
if [ -z "$GNOME_KEYRING_CONTROL" ]; then
  eval "$(/usr/bin/gnome-keyring-daemon --start --components=secrets 2>/dev/null)"
fi
```

Verify: `secret-tool lookup service xero-command-line username encryption-key` (after `xero login`).

**Without keyring** — either install the packages above, or use:

```bash
export XERO_KEY_STORAGE=file   # or set XERO_TOKEN_PASSPHRASE for a stronger file-based option
xero login
```

### OAuth scopes

By default, `xero login` requests a broad set of scopes suitable for full read/write CLI usage. To request a narrower scope set — for example a read-only integration — pass `--scope` with a space-separated list of API scopes:

```bash
xero login --scope "accounting.contacts.read accounting.settings.read accounting.invoices.read accounting.payments.read accounting.banktransactions.read accounting.manualjournals.read accounting.reports.balancesheet.read accounting.reports.profitandloss.read accounting.reports.trialbalance.read accounting.reports.aged.read accounting.budgets.read accounting.attachments.read"
```

Or set the `XERO_SCOPES` environment variable (same space-separated format):

```bash
XERO_SCOPES="accounting.invoices.read accounting.contacts.read" xero login
```
API credentials created before [Xero's March 2026 scope changes](https://developer.xero.com/faq/granular-scopes) where deprecated broader scopes like `accounting.transactions` and `accounting.reports` are available until September 2027 may request those scopes via the `--scope` override as well. `xero login` will request the granular scopes that replaced these deprecated broader scopes by default.

Required OAuth scopes (`openid`, `profile`, `email`, `offline_access`) are always prepended automatically — you only need to list the Xero API scopes your app supports. If you omit `--scope`, behaviour is unchanged from previous releases.

Re-run `xero login` (with or without `--scope`) whenever you change scopes; existing tokens retain the scopes granted at login time.

## Global Flags

Every command that calls the Xero API supports:

| Flag | Description |
|---|---|
| `-p, --profile <name>` | Use a specific profile (defaults to the default profile) |
| `--client-id <id>` | Override profile with an inline client ID |
| `--json` | Output raw JSON (for piping/scripting) |
| `--csv` | Output as CSV |
| `--toon` | Output as [TOON](https://github.com/toon-format/toon) (compact, LLM-friendly) |

Environment variables `XERO_PROFILE` and `XERO_CLIENT_ID` are also supported. Token storage can be tuned with `XERO_KEY_STORAGE` (`auto`, `keyring`, `file`) and `XERO_TOKEN_PASSPHRASE` (see [Token storage](#token-storage)). The `xero login` command additionally accepts `XERO_SCOPES` (see [OAuth scopes](#oauth-scopes) above).

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

### Currencies

```bash
xero currencies list
xero currencies list --json
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

# TOON (compact format, ~40% fewer tokens — ideal for LLM pipelines)
xero contacts list --toon
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
