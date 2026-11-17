import { settings } from '@unbound-app/settings';
import { commands } from '@unbound-app/api';

import { uwuify } from '~/lib/uwuify';

/**
 * @description Registers /uwu, which sends its text in uwu speak.
 */
export function registerUwuCommand(): void {
	commands.register({
		uwu: {
			description: 'COMMAND_DESC',
			options: {
				text: commands.option.string({ description: 'COMMAND_TEXT_DESC', required: true }),
			},
			execute: ({ text }: { text: string }) => uwuify(text, settings),
		},
	});
}
