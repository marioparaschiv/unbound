import { createLogger } from '@unbound-app/logger';

import { guardChatRows } from '~/diagnostics/chat-row-guard';
import { findByProps } from '~/metro/lookups';
import { Dispatcher } from '~/flux/modules';
import { after } from '~/patcher/api';

/** One of Discord's Sentry breadcrumbs; only its category and message are kept, never its data. */
export type Breadcrumb = { category?: string; message?: string; type?: string };

type Entry = { time: string; text: string; count: number };

type ActionLike = { type: string };

type ActionInterceptor = {
	addInterceptor(interceptor: (action: ActionLike) => boolean): void;
};

type BreadcrumbHelper = { addBreadcrumb(breadcrumb?: Breadcrumb): void };

const BREADCRUMBS_FILE = 'Unbound/Data/breadcrumbs.json';
const LIMIT = 30;
const LINE_LIMIT = 240;
const SAVE_DELAY_MS = 5_000;

const logger = createLogger('Diagnostics', 'Breadcrumbs');

const entries: Entry[] = [];
let previous: Promise<string[]> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let installed = false;
let recording = false;
let unpatchHelper: (() => void) | undefined;
let stopWatchingChatRows: (() => void) | undefined;

function lineOf({ time, text, count }: Entry): string {
	return `${time} ${text}${count > 1 ? ` ×${count}` : ''}`.slice(0, LINE_LIMIT);
}

function isLines(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((line) => typeof line === 'string');
}

async function readPrevious(): Promise<string[]> {
	try {
		const { default: fs } = await import('~/native/fs');

		if (!(await fs.exists(BREADCRUMBS_FILE))) {
			return [];
		}

		const parsed: unknown = JSON.parse(await fs.readFile(BREADCRUMBS_FILE));

		return isLines(parsed) ? parsed.slice(-LIMIT) : [];
	} catch (error) {
		logger.warn(`Failed to read breadcrumbs from ${BREADCRUMBS_FILE}:`, error);

		return [];
	}
}

async function save() {
	saveTimer = undefined;
	await previousBreadcrumbs();

	try {
		const { default: fs } = await import('~/native/fs');

		await fs.writeFile(BREADCRUMBS_FILE, JSON.stringify(recentBreadcrumbs()));
	} catch (error) {
		logger.warn(`Failed to save breadcrumbs to ${BREADCRUMBS_FILE}:`, error);
	}
}

function record(text: string) {
	const last = entries.at(-1);

	if (last?.text === text) {
		last.count++;
	} else {
		entries.push({ time: new Date().toISOString().slice(11, 19), text, count: 1 });
	}

	if (entries.length > LIMIT) {
		entries.splice(0, entries.length - LIMIT);
	}

	saveTimer ??= setTimeout(() => void save(), SAVE_DELAY_MS);
}

/**
 * @description Reads the breadcrumbs the previous launch saved, before this launch overwrites them.
 * @returns The previous launch's breadcrumbs, oldest first.
 */
export function previousBreadcrumbs(): Promise<string[]> {
	previous ??= readPrevious();

	return previous;
}

/**
 * @description Keeps one of Discord's breadcrumbs for crash reports, by its category and message.
 * @param breadcrumb What Discord recorded.
 */
export function recordBreadcrumb(breadcrumb: Breadcrumb | undefined): void {
	if (recording && breadcrumb) {
		record(
			`${breadcrumb.category || breadcrumb.type || 'event'}: ${breadcrumb.message ?? ''}`.trim(),
		);
	}
}

/**
 * @description Keeps a Flux action's type, never its payload; repeats of one type collapse into a count.
 * @param type The action type.
 */
export function recordAction(type: string): void {
	if (recording) {
		record(`action: ${type}`);
	}
}

/**
 * @description Lists this launch's breadcrumbs.
 * @returns The newest breadcrumbs as timestamped lines, oldest first.
 */
export function recentBreadcrumbs(): string[] {
	return entries.map(lineOf);
}

/**
 * @description Starts keeping breadcrumbs: every Flux action's type through one dispatcher interceptor, and Discord's
 * own breadcrumbs. They are saved every few seconds for the next launch's crash report.
 */
export function startBreadcrumbs(): void {
	recording = true;

	if (!installed) {
		installed = true;
		const dispatcher: ActionInterceptor = Dispatcher;

		dispatcher.addInterceptor((action) => {
			recordAction(action.type);

			return false;
		});
	}

	const helper = findByProps('addBreadcrumb', 'captureCrash', 'markCrashHandled') as
		| BreadcrumbHelper
		| undefined;

	unpatchHelper = helper
		? after(helper, 'addBreadcrumb', ({ args: [breadcrumb] }) => recordBreadcrumb(breadcrumb))
		: undefined;
	stopWatchingChatRows = guardChatRows((line) => {
		if (recording) {
			record(line);
		}
	});
}

/**
 * @description Stops keeping breadcrumbs. Discord's dispatcher cannot remove an interceptor, so it stays and records nothing.
 */
export function stopBreadcrumbs(): void {
	recording = false;
	unpatchHelper?.();
	unpatchHelper = undefined;
	stopWatchingChatRows?.();
	stopWatchingChatRows = undefined;
}
