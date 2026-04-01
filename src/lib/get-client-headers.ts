import {getPackageVersion} from './get-package-version.js'

export function getClientHeaders(): {headers: Record<string, string>} {
  return {
    headers: {
      'user-agent': `xero-command-line-${getPackageVersion()}`,
    },
  }
}
