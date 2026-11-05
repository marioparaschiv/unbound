#!/usr/bin/env bun
// The important part of the loader's own log (unbound.log) for one Discord run.
import { appPaths, DISCORD, processes, Vphone } from './vphone.ts';

/** Printed by --help and on a bad argument. */
const USAGE = `The important part of the loader's own log for one Discord run: errors and warnings, deduplicated with counts
and network noise dropped, then the last lines. The log is Documents/Unbound/Logs/unbound.log, rotated at 1 MB
into unbound.1.log and unbound.2.log; lines read \`2026-11-05T12:42:04.270Z E [category] message\`, in UTC.
  unbound-log [--since <ISO|epoch s>] [--until <ISO|epoch s>] [--tail <n>] [--all]
Default window: the running Discord's start to now. \`--all\` prints every line of the window.`;

/** One log entry; lines without a timestamp continue the entry above them. */
export type LogEntry = {
	time: string;
	level: string;
	category: string;
	message: string;
	extra: string[];
};

/** The entries of a window, and the oldest time still on disk (an older window has rotated out). */
export type LogWindow = { entries: LogEntry[]; oldest: string | undefined };

type Counted = { entry: LogEntry; count: number };

/** Lines that say nothing about Unbound: Discord's own network errors and analytics SDK chatter. */
const NOISE = [
	/NSURLErrorDomain \(-10\d\d\)/,
	/kCFErrorDomainCFNetwork \(-10\d\d\)/,
	/com\.appsflyer/,
];
const LISTED = 15;

/**
 * @description Converts a crash report time, an ISO time or epoch seconds to an ISO time in UTC.
 * @param value The time.
 * @returns The ISO time.
 */
export function toIso(value: string): string {
	if (/^\d+(\.\d+)?$/.test(value)) {
		return new Date(Number(value) * 1000).toISOString();
	}

	return new Date(value.replace(' +0000', 'Z').replace(' ', 'T')).toISOString();
}

/**
 * @description Reads the log entries between two instants across the rotated files, filtering on the device.
 * @param vphone The session.
 * @param since The window's start, an ISO time.
 * @param until The window's end, an ISO time.
 * @returns The window's entries and the oldest time on disk.
 */
export async function readWindow(vphone: Vphone, since: string, until: string): Promise<LogWindow> {
	const folder = `/rootfs${(await appPaths(vphone, DISCORD)).documentsPath}/Unbound/Logs`;
	// Oldest file first; the first output line names the oldest time on disk.
	const filter = `'NR == 1 { print "oldest " $1 } /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/ { keep = ($1 >= s && $1 <= u) } keep'`;
	const command = `cd '${folder}' 2>/dev/null || exit 0; cat unbound.2.log unbound.1.log unbound.log 2>/dev/null | awk -v s='${since}' -v u='${until}' ${filter}`;
	const [first = '', ...lines] = (await vphone.text('shell', { command, root: true })).split(
		'\n',
	);
	const entries: LogEntry[] = [];

	for (const line of lines) {
		const match = /^(\S+) ([DIWE]) \[([^\]]*)\] (.*)$/.exec(line);
		const last = entries.at(-1);

		if (match) {
			entries.push({
				time: match[1],
				level: match[2],
				category: match[3],
				message: match[4],
				extra: [],
			});
		} else if (line.trim() && last) {
			last.extra.push(line);
		}
	}

	return { entries, oldest: first.startsWith('oldest ') ? first.slice(7) : undefined };
}

const clip = (text: string, max = 220) => (text.length > max ? `${text.slice(0, max)}…` : text);
const format = (entry: LogEntry) =>
	`${entry.time.slice(11, 23)} ${entry.level} [${entry.category}] ${clip(entry.message)}`;

function listed(label: string, items: Counted[]): string[] {
	const lines = [`  ${label}: ${items.length}`];

	for (const { entry, count } of items.slice(0, LISTED)) {
		lines.push(`    ${format(entry)}${count > 1 ? `  (x${count})` : ''}`);
	}

	if (items.length > LISTED) {
		lines.push(`    … ${items.length - LISTED} more`);
	}

	return lines;
}

/**
 * @description Keeps what matters in a window: its errors and warnings, deduplicated, then its last lines.
 * @param window The window.
 * @param tail How many of the last lines to show.
 * @returns The summary, indented for nesting under a heading.
 */
export function summariseLog(window: LogWindow, tail = 12): string {
	const { entries, oldest } = window;

	if (!entries.length) {
		return oldest
			? `  no lines in this window: the log has rotated past it (oldest line ${oldest})`
			: '  no unbound.log on the device';
	}

	const counts = new Map<string, Counted>();

	for (const entry of entries) {
		const seen = counts.get(`${entry.level} ${entry.category} ${entry.message}`);

		if (seen) {
			seen.count++;
		} else if (
			(entry.level === 'E' || entry.level === 'W') &&
			!NOISE.some((noise) => noise.test(entry.message))
		) {
			counts.set(`${entry.level} ${entry.category} ${entry.message}`, { entry, count: 1 });
		}
	}

	const all = [...counts.values()];

	return [
		`  ${entries.length} lines from ${entries[0].time} to ${entries.at(-1)?.time}`,
		...listed(
			'errors',
			all.filter(({ entry }) => entry.level === 'E'),
		),
		...listed(
			'warnings',
			all.filter(({ entry }) => entry.level === 'W'),
		),
		`  last ${Math.min(tail, entries.length)} lines:`,
		...entries.slice(-tail).map((entry) => `    ${format(entry)}`),
	].join('\n');
}

async function main(argv: string[]) {
	let since: string | undefined;
	let until = new Date(Date.now() + 60_000).toISOString();
	let tail = 12;
	let all = false;

	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--since') {
			since = toIso(argv[++i]);
		} else if (argv[i] === '--until') {
			until = toIso(argv[++i]);
		} else if (argv[i] === '--tail') {
			tail = Number(argv[++i]);
		} else if (argv[i] === '--all') {
			all = true;
		} else {
			throw new Error(`Unexpected argument ${argv[i]}\n\n${USAGE}`);
		}
	}

	const vphone = new Vphone();

	try {
		const start = (await processes(vphone)).find(
			(entry) => entry.bundleId === DISCORD,
		)?.startTime;

		since ??= start === undefined ? undefined : toIso(String(start));

		if (!since) {
			throw new Error(
				'Discord is not running: pass --since, or use crashes for the last run',
			);
		}

		const window = await readWindow(vphone, since, until);
		const full = window.entries.map((entry) =>
			[
				`${entry.time} ${entry.level} [${entry.category}] ${entry.message}`,
				...entry.extra,
			].join('\n'),
		);

		console.log(
			all ? full.join('\n') : `unbound.log, this run:\n${summariseLog(window, tail)}`,
		);
	} finally {
		vphone.close();
	}
}

if (import.meta.main) {
	if (process.argv.includes('--help') || process.argv.includes('-h')) {
		console.log(USAGE);
		process.exit(0);
	}

	main(process.argv.slice(2)).catch((error: Error) => {
		console.error(error.message);
		process.exit(1);
	});
}
