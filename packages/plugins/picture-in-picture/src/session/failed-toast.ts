import { toasts } from '@unbound-app/api';

import { PLUGIN_NAME } from '~/constants';

/**
 * @description Tells the user the system did not open the picture in picture window.
 */
export function showStartFailed(): void {
	toasts.show({
		title: PLUGIN_NAME,
		content: "Picture in picture didn't start for this video.",
	});
}
