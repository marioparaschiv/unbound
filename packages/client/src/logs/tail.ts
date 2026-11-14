import type { UnboundLogEntry } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import fs from '~/native/fs';

import { LOG_LIMIT, mergeLogEntries } from './merge';
import { parseLogLine } from './entry';
import { LOG_FILES } from './files';

const Logger = createLogger('Logs', 'Tail');

/**
 * @description Reads a log file's newest lines.
 * @param path The file, relative to the documents folder.
 * @param count How many lines to keep.
 * @returns The lines, oldest first; none when the file is missing or unreadable.
 */
export async function readLogLines(path: string, count: number = LOG_LIMIT): Promise<string[]> {
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

/**
 * @description Reads the newest lines of both log files as entries, merged by time.
 * @param count How many entries to keep.
 * @returns The entries, oldest first.
 */
export async function readLogTail(count: number = LOG_LIMIT): Promise<UnboundLogEntry[]> {
	const files = await Promise.all(LOG_FILES.map((path) => readLogLines(path, count)));
	const lists = files.map((lines) =>
		lines.flatMap((line) => {
			const entry = parseLogLine(line);

			return entry ? [entry] : [];
		}),
	);

	return mergeLogEntries(lists, count);
}
