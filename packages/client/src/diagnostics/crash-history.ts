import type { CrashOrigin } from '@unbound-app/contracts/crash-reports';
import { createLogger } from '@unbound-app/logger';

const CRASH_HISTORY_FILE = 'Unbound/Data/crash-history.json';
const LIMIT = 30;

const logger = createLogger('Crash History');

/** One crash this install saw, kept whether or not it was reported. */
export type CrashRecord = {
	at: number;
	kind: string;
	message: string;
	addon?: string;
	where?: string;
	origin?: CrashOrigin;
	reportId?: string;
	/** The GitHub issue that tracks this crash, when the server filed it there. */
	issue?: CrashIssueLink;
	issuePending?: boolean;
};

/** A GitHub issue that tracks a crash. */
export type CrashIssueLink = { number: number; url: string };

function isIssueLink(value: CrashIssueLink): boolean {
	return (
		typeof value === 'object' &&
		typeof value.number === 'number' &&
		typeof value.url === 'string'
	);
}

function isCrashRecord(value: unknown): value is CrashRecord {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const record = value as Partial<CrashRecord>;

	return (
		typeof record.at === 'number' &&
		typeof record.kind === 'string' &&
		typeof record.message === 'string' &&
		(record.addon === undefined || typeof record.addon === 'string') &&
		(record.where === undefined || typeof record.where === 'string') &&
		(record.issuePending === undefined || typeof record.issuePending === 'boolean') &&
		(record.issue === undefined || isIssueLink(record.issue))
	);
}

async function write(records: CrashRecord[]): Promise<void> {
	try {
		const { default: fs } = await import('~/native/fs');

		await fs.writeFile(CRASH_HISTORY_FILE, JSON.stringify(records.slice(-LIMIT)));
	} catch (error) {
		logger.warn(`Failed to save crash history to ${CRASH_HISTORY_FILE}:`, error);
	}
}

/**
 * @description Reads the crashes this install saw, oldest first.
 * @returns The crashes, or none when the file is missing or unreadable.
 */
export async function readCrashHistory(): Promise<CrashRecord[]> {
	try {
		const { default: fs } = await import('~/native/fs');

		if (!(await fs.exists(CRASH_HISTORY_FILE))) {
			return [];
		}

		const parsed: unknown = JSON.parse(await fs.readFile(CRASH_HISTORY_FILE));

		return Array.isArray(parsed) ? parsed.filter(isCrashRecord) : [];
	} catch (error) {
		logger.warn(`Failed to read crash history from ${CRASH_HISTORY_FILE}:`, error);

		return [];
	}
}

/**
 * @description Adds a crash to the history once; a crash already recorded at the same time is left as it is.
 * @param record The crash.
 */
export async function recordCrash(record: CrashRecord): Promise<void> {
	const records = await readCrashHistory();

	if (records.some((known) => known.at === record.at && known.message === record.message)) {
		return;
	}

	await write([...records, record]);
}

/**
 * @description Adds where a recorded crash came from and its report id once it was sent.
 * @param at When the crash happened.
 * @param sent The report's origin and id.
 */
export async function markCrashReported(
	at: number,
	sent: Pick<CrashRecord, 'origin' | 'reportId' | 'issue' | 'issuePending'>,
): Promise<void> {
	const records = await readCrashHistory();

	await write(records.map((record) => (record.at === at ? { ...record, ...sent } : record)));
}

/**
 * @description Forgets every recorded crash.
 */
export async function clearCrashHistory(): Promise<void> {
	await write([]);
}
