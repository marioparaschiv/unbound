import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useSignIn from './use-sign-in';

type SignInRowProps = {
	subLabel?: string;
};

/** @description A row that signs in to the account with Discord. */
function SignInRow({ subLabel }: SignInRowProps) {
	const { busy, start } = useSignIn();

	return (
		<Discord.TableRow
			label={messages.UNBOUND_ACCOUNT_SIGN_IN}
			subLabel={subLabel}
			icon={<Discord.TableRowIcon source={icons.ClydeIcon} />}
			arrow
			disabled={busy}
			onPress={start}
		/>
	);
}

export default SignInRow;
