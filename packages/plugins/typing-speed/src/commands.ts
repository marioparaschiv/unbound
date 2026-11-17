import { commands, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { averageSpeed } from '~/lib/speed';

/**
 * @description Registers /typing-speed, which shows your average and best typing speed.
 */
export function registerStatsCommand(): void {
	commands.register({
		'typing-speed': {
			description: 'STATS_DESC',
			execute: () => {
				const average = averageSpeed(settings);

				toasts.show({
					title: addon.name,
					content:
						average === undefined
							? messages.NO_STATS
							: format('STATS', {
									average,
									messages: settings.messages,
									best: settings.bestWpm,
								}),
				});
			},
		},
	});
}
