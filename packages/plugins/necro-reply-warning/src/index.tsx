import { guardSends, type SendArgs } from '@unbound-plugins/shared/composer/held-send';
import { dialogs } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { messageAgeDays } from '~/lib/age';

function guardReply([, , , options]: SendArgs): boolean | Promise<boolean> {
	const repliedTo = options?.messageReference?.message_id;
	const days = repliedTo ? messageAgeDays(repliedTo, Date.now()) : undefined;

	if (days === undefined || days < settings.days) return true;

	return dialogs.confirm('CONFIRM_TITLE', {
		body: 'CONFIRM_BODY',
		bodyVars: { days: String(days) },
		confirm: 'CONFIRM_SEND',
		cancel: 'CONFIRM_EDIT',
	});
}

export function start() {
	guardSends('Necro Reply Warning', guardReply);
}
