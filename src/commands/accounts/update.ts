import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {accountUpdateSchema, accountFileUpdateSchema, formatZodError} from '../../lib/validators.js'
import type {Account} from 'xero-node'

export default class AccountsUpdate extends BaseCommand {
  static override description = 'Update an account in Xero'

  static override examples = [
    '<%= config.bin %> accounts update --account-id abc-123 --name "New Name"',
    '<%= config.bin %> accounts update --file account-update.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with account update data'}),
    'account-id': Flags.string({description: 'Account ID'}),
    name: Flags.string({description: 'Account name'}),
    code: Flags.string({description: 'Account code'}),
    description: Flags.string({description: 'Account description'}),
    status: Flags.string({description: 'Account status (ACTIVE or ARCHIVED)'}),
    'tax-type': Flags.string({description: 'Tax type'}),
    'enable-payments-to-account': Flags.boolean({description: 'Enable payments to account', allowNo: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AccountsUpdate)

    if (flags.file) {
      const fileData = this.readJsonFile(flags.file) as Record<string, unknown>
      const parsed = accountFileUpdateSchema.safeParse(fileData)
      if (!parsed.success) {
        this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
      }

      const accountID = parsed.data.accountID

      const result = await this.xeroCall(flags, async (xero, tenantId) => {
        const response = await xero.accountingApi.updateAccount(tenantId, accountID, {accounts: [fileData as Account]})
        return response.body.accounts?.[0]
      })

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2))
      } else {
        const r = result as Record<string, unknown> | undefined
        this.log(`Account updated: ${r?.name} (${r?.accountID})`)
      }
    } else {
      const data = {
        accountId: flags['account-id'],
        name: flags.name,
        code: flags.code,
        description: flags.description,
        status: flags.status,
        taxType: flags['tax-type'],
        enablePaymentsToAccount: flags['enable-payments-to-account'],
      }

      const parsed = accountUpdateSchema.safeParse(data)
      if (!parsed.success) {
        this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
      }

      const result = await this.xeroCall(flags, async (xero, tenantId) => {
        const account: Account = {
          accountID: parsed.data.accountId,
          name: parsed.data.name,
          code: parsed.data.code,
          description: parsed.data.description,
          status: parsed.data.status as Account['status'],
          taxType: parsed.data.taxType,
          enablePaymentsToAccount: parsed.data.enablePaymentsToAccount,
        }
        const response = await xero.accountingApi.updateAccount(tenantId, parsed.data.accountId, {accounts: [account]})
        return response.body.accounts?.[0]
      })

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2))
      } else {
        const r = result as Record<string, unknown> | undefined
        this.log(`Account updated: ${r?.name} (${r?.accountID})`)
      }
    }
  }
}
