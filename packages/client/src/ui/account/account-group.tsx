import { Discord } from '~/metro/components';
import { useAccount } from '~/account/api';
import { messages } from '~/i18n/api';

import AccountRow from './account-row';
import SignInRow from './sign-in-row';

/** @description The Unbound account: a sign-in row when signed out, the account when signed in. */
function AccountGroup() {
	const account = useAccount();

	return (
		<Discord.TableRowGroup title={messages.UNBOUND_ACCOUNT}>
			{account ? (
				<AccountRow account={account} />
			) : (
				<SignInRow subLabel={messages.UNBOUND_ACCOUNT_SIGN_IN_DESC} />
			)}
		</Discord.TableRowGroup>
	);
}

export default AccountGroup;
