import { terminal } from 'terminal-kit';

import { addHistoryItem, history } from './history';
import { send } from './ws';

export const state: {
	repl: ReturnType<typeof terminal.inputField> | null;
	currentInput: string;
} = {
	repl: null,
	currentInput: '',
};

export function setupReplListeners() {
	terminal.on('key', (name: string, ...t) => {
		if (name !== 'CTRL_C') return;
		process.exit(0);
	});
}

export async function takeReplInput() {
	abortCurrentReplInput();

	terminal.bold.cyan('» ');

	state.repl = terminal.inputField(
		{
			minLength: 1,
			history,
		},
		(error, input) => {
			if (error) return console.error(error);
			if (!input) return;

			state.currentInput = input;
			abortCurrentReplInput({ deletePrompt: true });
			terminal.white.bold(`» ${input}\n`);
			addHistoryItem(input);
			send(input);

			takeReplInput();
		},
	);

	const r = await state.repl.promise;
	console.log(r);
}

interface AbortOptions {
	deletePrompt?: boolean;
	deleteCurrentInput?: boolean;
}

export function abortCurrentReplInput({
	deletePrompt = false,
	deleteCurrentInput = false,
}: AbortOptions = {}) {
	if (state.repl) {
		state.repl.abort();
		state.repl = null;
		if (deletePrompt) terminal.deleteLine(-1);
		if (deleteCurrentInput) state.currentInput = '';
	}
}
