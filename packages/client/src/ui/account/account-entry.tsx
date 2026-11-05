import { useAccount } from '~/account/api';
import { messages } from '~/i18n/api';

import AccountRow from './account-row';
import SignInRow from './sign-in-row';

/** @description The Unbound account's row: a sign-in row when signed out, the account when signed in. */
function AccountEntry() {
	const account = useAccount();

	return account ? (
		<AccountRow account={account} />
	) : (
		<SignInRow subLabel={messages.UNBOUND_ACCOUNT_SIGN_IN_DESC} />
	);
}

export default AccountEntry;
