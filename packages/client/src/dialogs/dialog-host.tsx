import { useEffect } from 'react';

import { failDialogHost, holdDialogHost } from '~/dialogs/host';
import DialogBoundary from '~/dialogs/dialog-boundary';
import { Discord } from '~/metro/components';

/**
 * @description A copy of Discord's alert host, for a screen that unmounts Discord's, such as the crash screen, so its
 * dialogs show as Discord's. When the copy is missing or fails to render, dialogs use the system alert instead.
 */
function DialogHost() {
	const Container = Discord.AlertModalContainer;

	useEffect(() => {
		const release = holdDialogHost();

		if (!Container) {
			failDialogHost();
		}

		return release;
	}, []);

	if (!Container) return null;

	return (
		<DialogBoundary onError={failDialogHost}>
			<Container />
		</DialogBoundary>
	);
}

export default DialogHost;
