import { refresh } from '~/account/api';

/** Refreshes the account in the background. */
export function start() {
	void refresh();
}

export default { start };
