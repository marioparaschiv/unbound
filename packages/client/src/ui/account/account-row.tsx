import { Avatars, DefaultAvatars, Discord } from '~/metro/components';
import { format, messages } from '~/i18n/api';
import type { Account } from '~/account/api';
import { signOut } from '~/account/api';

type AccountRowProps = {
	account: Account;
};

/** @description The signed-in account; pressing it asks to sign out. */
function AccountRow({ account }: AccountRowProps) {
	const { Avatar, AvatarSizes } = Avatars;
	const source = account.image ? { uri: account.image } : DefaultAvatars.DEFAULT_AVATARS[0];

	function confirmSignOut() {
		Discord.showConfirmModal({
			title: messages.UNBOUND_ACCOUNT_SIGN_OUT,
			content: format('UNBOUND_ACCOUNT_SIGN_OUT_CONFIRM', { name: account.name }),
			confirmText: messages.UNBOUND_ACCOUNT_SIGN_OUT,
			cancelText: messages.UNBOUND_CANCEL,
			onConfirm: () => void signOut(),
		});
	}

	return (
		<Discord.TableRow
			label={account.name}
			subLabel={messages.UNBOUND_ACCOUNT_SIGNED_IN}
			icon={<Avatar source={source} size={AvatarSizes.SMALL} />}
			onPress={confirmSignOut}
		/>
	);
}

export default AccountRow;
