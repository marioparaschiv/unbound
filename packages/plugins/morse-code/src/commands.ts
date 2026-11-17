import { commands, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { encodeMorse } from '~/lib/morse';

/**
 * @description Registers /morse, which sends its text as Morse code.
 */
export function registerMorseCommand(): void {
	commands.register({
		morse: {
			description: 'MORSE_DESC',
			options: { text: commands.option.string({ description: 'TEXT_DESC', required: true }) },
			execute: ({ text }: { text: string }) => {
				const code = encodeMorse(text);

				if (!code) toasts.show({ title: addon.name, content: messages.NOTHING_TO_SEND });

				return code || undefined;
			},
		},
	});
}
