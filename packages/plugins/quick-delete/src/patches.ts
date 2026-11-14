import { metro, patcher } from '@unbound-app/api';

import { isDeleteConfirmation, type AlertOptions } from '~/lib/confirmation';
import { deleteTitle } from '~/lib/delete-label';

/**
 * @description Deletes messages without the confirmation. Patches `show` on Discord's legacy alert module and confirms the
 * "Delete Message" alert instead of showing it; every other alert shows as before.
 */
export function patchDeleteConfirmation(): void {
	const Alerts = metro.findByProps('show', 'openLazy', 'confirm');

	if (!Alerts) {
		logger.warn('Quick delete skipped: Discord moved its alert module.');

		return;
	}

	patcher.instead(Alerts, 'show', ({ args, original }) => {
		const options = args[0] as AlertOptions | undefined;

		if (!isDeleteConfirmation(options, deleteTitle())) return original(...args);

		options!.onConfirm!();
	});
}
