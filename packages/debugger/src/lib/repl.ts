import { terminal } from 'terminal-kit';

import { addHistoryItem, history } from './history';
import { send } from './ws';


export const state: {
	repl: ReturnType<typeof terminal.inputField> | null;
} = {
	repl: null
};

export function setupReplListeners() {
	terminal.on('key', (name: string) => {
		if (name !== 'CTRL_C') return;
		process.exit(0);
	});
}

export async function takeReplInput() {
	abortCurrentReplInput();

	terminal.bold.cyan('» ');

	state.repl = terminal.inputField({
		minLength: 1,
		history
	}, (error, input) => {
		if (error) return console.error(error);
		if (!input) return;

		abortCurrentReplInput(true);
		terminal.white.bold(`» ${input}\n`);
		addHistoryItem(input);
		send(input);

		takeReplInput();
	});
}

export function abortCurrentReplInput(shouldDeletePrompt: boolean = false) {
	if (state.repl) {
		state.repl.abort();
		state.repl = null;
		if (shouldDeletePrompt) terminal.deleteLine(-1);
	}
}