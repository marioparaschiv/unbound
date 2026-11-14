import { createLogger } from '@unbound-app/logger';

import fs from '~/native/fs';

const Logger = createLogger('Logs', 'Tail');

/**
 * @description Reads a log file's newest lines.
 * @param path The file, relative to the documents folder.
 * @param count How many lines to keep.
 * @returns The lines, oldest first; none when the file is missing or unreadable.
 */
export async function readLogLines(path: string, count: number): Promise<string[]> {
	try {
		if (!(await fs.exists(path))) {
			return [];
		}

		const lines = (await fs.readFile(path)).split('\n').filter((line) => line.trim() !== '');

		return lines.slice(-count);
	} catch (error) {
		Logger.error(`Failed to read log file ${path}:`, error);

		return [];
	}
}
