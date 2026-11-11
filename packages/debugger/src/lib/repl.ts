import { terminal } from 'terminal-kit';

import { addHistoryItem, history } from './history';
import * as session from './session';

export const state: {
	repl: ReturnType<typeof terminal.inputField> | null;
	currentInput: string;
} = {
	repl: null,
	currentInput: '',
};

/** @description Exits the debugger on Ctrl+C. */
export function setupReplListeners() {
	terminal.on('key', (name: string) => {
		if (name !== 'CTRL_C') return;

		process.exit(0);
	});
}

/** @description Draws a fresh prompt and evaluates the submitted line on the device. */
export async function takeReplInput() {
	abortCurrentReplInput();

	terminal.bold.cyan('» ');

	state.repl = terminal.inputField(
		{
			minLength: 1,
			history,
		},
		(error, input) => {
			if (error) {
				return console.error(error);
			}

			if (!input) return;

			state.currentInput = input;
			abortCurrentReplInput({ deletePrompt: true });
			terminal.white.bold(`» ${input}\n`);
			addHistoryItem(input);

			session.evaluate(input).then((result) => {
				if (result.ok) {
					terminal.gray(`« ${result.value}\n`);
				} else {
					terminal.red(`« ${result.error}\n`);
				}

				takeReplInput();
			});
		},
	);

	await state.repl.promise;
}

type AbortOptions = {
	deletePrompt?: boolean;
	deleteCurrentInput?: boolean;
};

/** @description Cancels the active prompt, optionally erasing it and the pending input. */
export function abortCurrentReplInput({
	deletePrompt = false,
	deleteCurrentInput = false,
}: AbortOptions = {}) {
	if (!state.repl) {
		return;
	}

	state.repl.abort();
	state.repl = null;

	if (deletePrompt) {
		terminal.deleteLine(-1);
	}

	if (deleteCurrentInput) {
		state.currentInput = '';
	}
}
