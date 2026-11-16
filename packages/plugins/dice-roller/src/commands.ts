import { commands } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { DiceError, formatRoll, parseDice, randomFace, rollDice } from '~/lib/dice';

function errorText({ code, values }: DiceError): string {
	switch (code) {
		case 'EMPTY':
			return messages.EMPTY;
		case 'UNREADABLE':
			return format('UNREADABLE', { text: String(values.text) });
		case 'DICE_COUNT':
			return format('DICE_COUNT', { max: Number(values.max) });
		case 'SIDES':
			return format('SIDES', { max: Number(values.max) });
		case 'KEEP_COUNT':
			return format('KEEP_COUNT', { max: Number(values.max) });
	}
}

function rollText(expression: string): string {
	return formatRoll(expression, rollDice(parseDice(expression), randomFace));
}

/**
 * @description Adds `/roll`, which rolls a dice expression and sends each die and the total, or shows them only to
 * you.
 */
export function registerRoll(): void {
	commands.register({
		roll: {
			description: 'ROLL_DESC',
			options: {
				dice: commands.option.string({ description: 'ROLL_DICE', required: true }),
				private: commands.option.boolean({ description: 'ROLL_PRIVATE' }),
			},
			execute({ dice, private: secret }) {
				try {
					const content = rollText(dice);

					return secret ? { content, ephemeral: true } : { content };
				} catch (error) {
					if (!(error instanceof DiceError)) throw error;

					return { content: errorText(error), ephemeral: true };
				}
			},
		},
	});
}

export default { registerRoll };
