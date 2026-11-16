type CrashRecord = { at: number; crash: string; stack: string };

function isCrashRecord(entry: unknown): entry is CrashRecord {
	if (typeof entry !== 'object' || entry === null) {
		return false;
	}

	const [at, crash, stack]: unknown[] = ['at', 'crash', 'stack'].map((key) =>
		Reflect.get(entry, key),
	);

	return typeof at === 'number' && typeof crash === 'string' && typeof stack === 'string';
}

function readHistory(text: string): CrashRecord[] {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}

	return Array.isArray(parsed)
		? parsed.filter(isCrashRecord).filter((record) => record.stack.length > 0)
		: [];
}

function fileName({ at, crash }: CrashRecord): string {
	const time = Number.isFinite(at) ? new Date(at).toISOString().replace(/[:.]/g, '-') : 'unknown';
	const label = crash.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');

	return `crashes/${time}-${label || 'crash'}.txt`;
}

/**
 * @description Turns each crash the loader recorded with its stack into a text file for the diagnostics zip.
 * @param historyText The loader's `crash-history.json`.
 * @returns The stacks by file name, oldest first.
 */
export function crashStackFiles(historyText: string): Record<string, string> {
	return Object.fromEntries(
		readHistory(historyText).map((record) => [fileName(record), record.stack]),
	);
}

export default { crashStackFiles };
