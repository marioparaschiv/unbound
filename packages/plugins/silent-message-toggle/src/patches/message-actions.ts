import { patcher } from '@unbound-app/api';

import { Messages, SilentToggle, readSetting } from '~/modules';
import { withSilentFlag } from '~/silent';

type SendOptions = Record<string, unknown> & { flags?: unknown };

function isSendOptions(argument: unknown): argument is SendOptions {
	return typeof argument === 'object' && argument !== null;
}

/**
 * @description Sets the SUPPRESS_NOTIFICATIONS flag on each message sent while the toggle is on, attachments included, and turns the toggle off afterwards when Auto Disable is on.
 * @returns A function that removes the patch.
 */
export function patchMessageActions(): () => void {
	return patcher.before(Messages, '_sendMessage', ({ args }) => {
		const [channelId, , options] = args as unknown[];

		if (typeof channelId !== 'string') return;

		const silent = SilentToggle.takeForSend(channelId, {
			persist: readSetting('persistState'),
			autoDisable: readSetting('autoDisable'),
		});

		if (!silent) return;

		if (isSendOptions(options)) {
			options.flags = withSilentFlag(options.flags);

			return;
		}

		args[2] = { flags: withSilentFlag(undefined) };
	});
}
