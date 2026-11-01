import { useState } from 'react';

import { signIn } from '~/account/api';
import { messages } from '~/i18n/api';
import { show } from '~/toasts/api';

/**
 * @description Signs in to the account, tracking whether a sign-in is running and showing a toast
 * when it fails. The account domain logs the underlying error.
 * @returns Whether a sign-in is running, and the function that starts one, calling back once signed in.
 */
function useSignIn() {
	const [busy, setBusy] = useState(false);

	function start(onSignedIn?: () => void) {
		setBusy(true);

		void signIn()
			.then((result) => {
				if (result.status === 'signed-in') {
					onSignedIn?.();
				}

				if (result.status === 'failed') {
					show({
						title: messages.UNBOUND_ACCOUNT_SIGN_IN_FAILED,
						content: messages.UNBOUND_ACCOUNT_SIGN_IN_FAILED_DESC,
						icon: 'CircleXIcon',
					});
				}
			})
			.finally(() => setBusy(false));
	}

	return { busy, start };
}

export default useSignIn;
