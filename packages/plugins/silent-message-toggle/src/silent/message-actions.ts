import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { silentToggle, withSilentFlag } from '~/silent/toggle';
import { Messages } from '~/silent/modules';

type SendOptions = Record<string, unknown> & { flags?: unknown };

function isSendOptions(argument: unknown): argument is SendOptions {
	return typeof argument === 'object' && argument !== null;
}

/**
 * @description Sets the SUPPRESS_NOTIFICATIONS flag on each message sent while the toggle is on, attachments included, and turns the toggle off afterwards when Auto Disable is on.
 */
export function patchMessageActions(): void {
	patcher.before(Messages, '_sendMessage', ({ args }) => {
		const [channelId, , options] = args as unknown[];

		if (typeof channelId !== 'string') return;

		const silent = silentToggle.takeForSend(channelId, {
			persist: settings.persistState,
			autoDisable: settings.autoDisable,
		});

		if (!silent) return;

		if (isSendOptions(options)) {
			options.flags = withSilentFlag(options.flags);

			return;
		}

		args[2] = { flags: withSilentFlag(undefined) };
	});
}
