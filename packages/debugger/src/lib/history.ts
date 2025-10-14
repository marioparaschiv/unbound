import { terminal } from 'terminal-kit';
import { join } from 'node:path';


type History = string[];

const HISTORY_PATH = join(__dirname, '..', '..', '.history.json');
const HISTORY_FILE = Bun.file(HISTORY_PATH);

export let history: History = [];

export async function loadHistory() {
	try {
		if (await HISTORY_FILE.exists()) {
			history = await HISTORY_FILE.json();
		}
	} catch (error) {
		terminal.red.bold(`Failed to load history.\n`);
	}
}

export function addHistoryItem(item: string) {
	history.push(item);
	persistHistory();
}

export function persistHistory() {
	HISTORY_FILE.write(JSON.stringify(history, null, 2));
}