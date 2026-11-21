import type { CrashOrigin } from '@unbound-app/contracts/crash-reports';
import { createLogger } from '@unbound-app/logger';

const CRASH_HISTORY_FILE = 'Unbound/Data/crash-history.json';
const LIMIT = 30;
const ISSUE_STATES: readonly IssueState[] = ['open', 'fixed', 'closed'];

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
	issueState?: IssueState;
	/** How many installs reported this crash, in all and on the reporting version, when it was sent. */
	seen?: CrashSpread;
};

/** How many installs reported one crash, in all and on one client version. */
export type CrashSpread = { installs: number; versionInstalls: number };

/** Whether a crash's GitHub issue is open, closed as fixed, or closed for another reason. */
export type IssueState = 'open' | 'fixed' | 'closed';

/** A GitHub issue that tracks a crash. */
export type CrashIssueLink = { number: number; url: string };

function isIssueLink(value: CrashIssueLink): boolean {
	return (
		typeof value === 'object' &&
		typeof value.number === 'number' &&
		typeof value.url === 'string'
	);
}

function isSpread(value: unknown): value is CrashSpread {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Partial<CrashSpread>).installs === 'number' &&
		typeof (value as Partial<CrashSpread>).versionInstalls === 'number'
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
		(record.issueState === undefined || ISSUE_STATES.includes(record.issueState)) &&
		(record.issue === undefined || isIssueLink(record.issue)) &&
		(record.seen === undefined || isSpread(record.seen))
	);
}

function crashKey(record: CrashRecord): string {
	return [record.kind, record.addon ?? '', record.where ?? '', record.message].join('|');
}

/**
 * @description Gives every crash without an issue the newest issue another record of the same crash has, so a repeat
 * that was never sent links to its issue instead of offering to report it again.
 * @param records The crashes.
 * @returns The crashes with shared issues filled in.
 */
export function shareCrashIssues(records: CrashRecord[]): CrashRecord[] {
	const filed = new Map<string, CrashRecord>();

	for (const record of records) {
		const key = crashKey(record);
		const newest = filed.get(key);

		if (record.issue && (!newest || record.at > newest.at)) {
			filed.set(key, record);
		}
	}

	return records.map((record) => {
		const known = record.issue ? undefined : filed.get(crashKey(record));

		if (!known?.issue) {
			return record;
		}

		return {
			...record,
			issue: known.issue,
			issuePending: false,
			...(known.issueState ? { issueState: known.issueState } : {}),
		};
	});
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

		return Array.isArray(parsed) ? shareCrashIssues(parsed.filter(isCrashRecord)) : [];
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
	sent: Pick<
		CrashRecord,
		'origin' | 'reportId' | 'issue' | 'issuePending' | 'issueState' | 'seen'
	>,
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
