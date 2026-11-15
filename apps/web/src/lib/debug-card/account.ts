import type { DebugCardRequest as DebugInfo } from '@unbound-app/contracts/debug-cards';

const NEW_ACCOUNT_DAYS = 30;

/**
 * @description Lists what about the account can gate Discord features: a new account, and missing 2FA, phone or email.
 * @param account The reported account flags.
 * @returns The notes; empty for an established, verified account.
 */
export function accountNotes(account: DebugInfo['account']): string[] {
	if (!account) {
		return [];
	}

	return [
		account.ageDays < NEW_ACCOUNT_DAYS ? `new (${account.ageDays} d)` : undefined,
		account.mfa ? undefined : 'no 2FA',
		account.phone ? undefined : 'no phone',
		account.email ? undefined : 'email unverified',
	].filter((note): note is string => Boolean(note));
}

export default accountNotes;
