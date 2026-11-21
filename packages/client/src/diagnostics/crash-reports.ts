import type { CrashOrigin, CrashUnfiledReason } from '@unbound-app/contracts/crash-reports';
import { createLogger } from '@unbound-app/logger';
import uuid from '@unbound-app/utils/uuid';

import {
	buildCrashReport,
	crashReportAddon,
	type CrashEvent,
	type CrashReportAddon,
} from '~/diagnostics/crash-report';
import {
	markCrashReported,
	recordCrash,
	type CrashIssueLink,
	type CrashRecord,
} from '~/diagnostics/crash-history';
import {
	crashSignature,
	rememberReported,
	repeatsOf,
	wasJustReported,
} from '~/diagnostics/crash-repeats';
import {
	isBackgroundWatchdogKill,
	nativeCrashAddon,
	nativeCrashFrame,
} from '~/diagnostics/crash-title';
import { getSetting, setSetting } from '~/settings/unbound';
import { currentEnvironment } from '~/core/environment';
import { getLoader } from '~/native/unbound-native';
import { UNBOUND_LOG } from '~/logs/files';
import fs from '~/native/fs';

export type { CrashEvent, CrashReportAddon } from '~/diagnostics/crash-report';

type CrashReportIssue = { number: number; url: string; created: boolean };

const RETRIES_PER_LAUNCH = 3;
const MAX_STACK = 16_000;

type SentCrashReport = {
	id: string;
	origin?: CrashOrigin;
	issue?: CrashReportIssue;
	unfiled?: CrashUnfiledReason;
	tweak?: string;
};

/** What filing a recorded crash on GitHub came to. */
export type FiledCrash = {
	origin?: CrashOrigin;
	issue?: CrashIssueLink;
	unfiled?: CrashUnfiledReason;
	tweak?: string;
};

const logger = createLogger('Crash Reports');

/**
 * @description Reads whether the user turned crash reporting on. It is off until they do.
 * @returns Whether reports may be sent.
 */
function crashReportsEnabled(): boolean {
	return getSetting('crash-reports');
}

async function readLoaderLog(): Promise<string | undefined> {
	try {
		return (await fs.exists(UNBOUND_LOG)) ? await fs.readFile(UNBOUND_LOG) : undefined;
	} catch {
		return undefined;
	}
}

async function addonName(id: string | undefined): Promise<string> {
	if (!id) {
		return '';
	}

	const { plugins } = await import('~/plugins/manager');

	return plugins.getAddon(id)?.manifest.name ?? id;
}

async function announceReport(
	issue: CrashReportIssue | undefined,
	unfiled: CrashUnfiledReason | undefined,
	addon: string | undefined,
	tweak: string | undefined,
) {
	const { info } = await import('~/toasts/api');

	if (tweak) {
		info('UNBOUND_CRASH_REPORT_TWEAK', { name: tweak });
	} else if (issue) {
		info(issue.created ? 'UNBOUND_CRASH_REPORT_FILED' : 'UNBOUND_CRASH_REPORT_JOINED', {
			number: issue.number,
		});
	} else if (unfiled === 'third-party') {
		info('UNBOUND_CRASH_REPORT_THIRD_PARTY', { name: await addonName(addon) });
	} else {
		info('UNBOUND_CRASH_REPORT_SENT');
	}
}

async function consentToReport(event: CrashEvent): Promise<boolean> {
	if (crashReportsEnabled()) {
		return true;
	}

	const { askToReportCrash } = await import('~/diagnostics/crash-consent');

	return (await askToReportCrash(event.addon?.id)) !== 'declined';
}

function installId(): string {
	const existing = getSetting('crash-reports.installId');

	if (existing) {
		return existing;
	}

	const created = uuid(32);

	setSetting('crash-reports.installId', created);

	return created;
}

async function sendCrashReport(
	event: CrashEvent,
	breadcrumbs: string[],
	{
		signature = crashSignature(event),
		repeats,
		recordedAt,
		announce = true,
	}: { signature?: string; repeats?: number; recordedAt?: number; announce?: boolean } = {},
): Promise<SentCrashReport | undefined> {
	try {
		const { CLIENT_VERSION } = await import('~/core/constants');
		const { createUnboundClient } = await import('~/account/client');
		const environment = currentEnvironment(CLIENT_VERSION);
		const { crashContext } = await import('~/diagnostics/crash-context');
		const report =
			environment &&
			buildCrashReport(
				event,
				environment,
				await readLoaderLog(),
				{ ...(await crashContext(breadcrumbs)), ...(repeats ? { repeats } : {}) },
				installId(),
			);

		if (!report) {
			return undefined;
		}

		const request = createUnboundClient();
		const { id, issue, origin, unfiled, tweak, seen } = await request(
			'POST /api/v1/crash-reports',
			{
				body: report,
			},
		);

		rememberReported(signature);

		if (recordedAt !== undefined) {
			await markCrashReported(recordedAt, {
				reportId: id,
				...(origin ? { origin } : {}),
				...(issue ? { issue: { number: issue.number, url: issue.url } } : {}),
				...(!issue && unfiled !== 'third-party' ? { issuePending: true } : {}),
				...(seen ? { seen } : {}),
			});
		}

		if (announce) {
			const blamed =
				event.addon?.id ?? (event.stack ? nativeCrashAddon(event.stack) : undefined);

			await announceReport(issue, unfiled, blamed, tweak);
		}

		return {
			id,
			...(origin ? { origin } : {}),
			...(issue ? { issue } : {}),
			...(unfiled ? { unfiled } : {}),
			...(tweak ? { tweak } : {}),
		};
	} catch (error) {
		logger.warn(`Failed to send a ${event.kind} crash report:`, error);

		return undefined;
	}
}

/**
 * @description Sends a crash report when the user turned reporting on, and otherwise asks once per launch whether
 * to send it. The same crash within an hour is sent once. Failures are logged and never thrown.
 * @param event The failure the manager saw.
 * @returns The report's id, or `undefined` when the user declined or the report was not sent.
 */
export async function reportCrash(event: CrashEvent): Promise<string | undefined> {
	const recordedAt = Date.now();

	await recordCrash({
		at: recordedAt,
		kind: event.kind,
		message: event.message ?? event.kind,
		...(event.addon ? { addon: event.addon.id } : {}),
	});

	if (wasJustReported(crashSignature(event)) || !(await consentToReport(event))) {
		return undefined;
	}

	const { recentBreadcrumbs } = await import('~/diagnostics/breadcrumbs');

	return (await sendCrashReport(event, recentBreadcrumbs(), { recordedAt }))?.id;
}

/**
 * @description Sends the previous launch's native crash once, asking first while reporting is off, and remembers the
 * report's id for `/debug`. A declined crash is not asked about again; a crash loop is sent once, with its repeat count.
 * @param launch The loader's launch report.
 */
export async function reportNativeCrash(launch = getLoader()?.launch): Promise<void> {
	const stack = launch?.crashStack;
	const newest = launch?.crashes?.at(-1);

	if (!stack || !newest || getSetting('crash-reports.nativeAt') >= newest.at) {
		return;
	}

	const event: CrashEvent = { kind: 'native-crash', message: launch.lastCrash, stack };

	const where = nativeCrashFrame(stack);
	const addon = nativeCrashAddon(stack);

	await recordCrash({
		at: newest.at,
		kind: event.kind,
		message: newest.crash,
		...(where ? { where } : {}),
		...(addon ? { addon } : {}),
	});

	const signature = crashSignature({ kind: event.kind, message: newest.crash });

	if (
		isBackgroundWatchdogKill(stack) ||
		wasJustReported(signature) ||
		!(await consentToReport(event))
	) {
		setSetting('crash-reports.nativeAt', newest.at);

		return;
	}

	const { previousBreadcrumbs } = await import('~/diagnostics/breadcrumbs');
	const id = (
		await sendCrashReport(event, await previousBreadcrumbs(), {
			signature,
			repeats: repeatsOf(newest.crash, launch.crashes),
			recordedAt: newest.at,
		})
	)?.id;

	if (!id) {
		return;
	}

	setSetting('crash-reports.nativeAt', newest.at);
	setSetting('crash-reports.lastId', id);
}

const CRASH_KINDS: Record<CrashEvent['kind'], true> = {
	crash: true,
	freeze: true,
	'start-failure': true,
	'native-crash': true,
};

async function installedPlugin(id: string) {
	const { plugins } = await import('~/plugins/manager');

	return plugins.getAddon(id);
}

/**
 * @description Reports the newest hang MetricKit caught with a main-thread stack once, asking first while reporting is
 * off, and keeps it in the crash history.
 * @param launch The loader's launch report.
 */
export async function reportSystemHang(launch = getLoader()?.launch): Promise<void> {
	const hang = launch?.system?.lastHang;

	if (!hang?.stack || getSetting('crash-reports.hangAt') >= hang.at) {
		return;
	}

	setSetting('crash-reports.hangAt', hang.at);

	const message = hang.stack.split('\n')[0] ?? 'Hang';
	const where = nativeCrashFrame(hang.stack);
	const suspect = hang.addonId ? await installedPlugin(hang.addonId) : undefined;
	const event: CrashEvent = {
		kind: 'freeze',
		phase: 'frozen',
		seconds: hang.ms / 1000,
		message,
		stack: hang.stack,
		...(suspect ? { addon: crashReportAddon(suspect) } : {}),
	};

	await recordCrash({
		at: hang.at,
		kind: event.kind,
		message,
		...(hang.addonId ? { addon: hang.addonId } : {}),
		...(where ? { where } : {}),
	});

	if (wasJustReported(crashSignature(event)) || !(await consentToReport(event))) {
		return;
	}

	await sendCrashReport(event, [], { recordedAt: hang.at });
}

function isCrashKind(kind: string): kind is CrashEvent['kind'] {
	return Object.hasOwn(CRASH_KINDS, kind);
}

function recordedEvent(
	record: CrashRecord,
	addon: CrashReportAddon | undefined,
	caughtStack: string | undefined,
): CrashEvent | undefined {
	if (!isCrashKind(record.kind)) {
		return undefined;
	}

	const launch = getLoader()?.launch;
	const stack =
		record.kind === 'native-crash' && launch?.crashes?.at(-1)?.at === record.at
			? launch.crashStack
			: caughtStack?.slice(0, MAX_STACK);

	return {
		kind: record.kind,
		message: record.message,
		...(addon ? { addon } : {}),
		...(stack ? { stack } : {}),
	};
}

async function sendRecordedCrash(
	record: CrashRecord,
	addon: CrashReportAddon | undefined,
	stack: string | undefined,
): Promise<SentCrashReport | undefined> {
	if (record.reportId) {
		return { id: record.reportId, ...(record.origin ? { origin: record.origin } : {}) };
	}

	const event = recordedEvent(record, addon, stack);

	return event
		? sendCrashReport(event, [], { recordedAt: record.at, announce: false })
		: undefined;
}

async function requestIssue(reportId: string): Promise<FiledCrash | undefined> {
	try {
		const { createUnboundClient } = await import('~/account/client');
		const request = createUnboundClient();

		return await request('POST /api/v1/crash-reports/$id/issue', { params: { id: reportId } });
	} catch (error) {
		logger.warn(`Failed to file crash report ${reportId} on GitHub:`, error);

		return undefined;
	}
}

/**
 * @description Files a recorded crash on GitHub because the user asked to: sends its report when it was never sent,
 * then has the server open its issue or add it to the one that already tracks it.
 * @param record The crash.
 * @param addon The installed plugin the crash blamed, if any.
 * @param stack The crash's stack, when the caller still has it, such as the crash screen's error.
 * @returns The issue and where the crash came from, or `undefined` when the report could not be sent.
 */
export async function fileRecordedCrash(
	record: CrashRecord,
	addon?: CrashReportAddon,
	stack?: string,
): Promise<FiledCrash | undefined> {
	const sent = await sendRecordedCrash(record, addon, stack);

	if (!sent) {
		return undefined;
	}

	const filed = sent.issue ? sent : await requestIssue(sent.id);
	const origin = filed?.origin ?? sent.origin;
	const issue = filed?.issue && { number: filed.issue.number, url: filed.issue.url };
	const unfiled = issue ? undefined : (filed?.unfiled ?? sent.unfiled);
	const tweak = filed?.tweak ?? sent.tweak;

	await markCrashReported(record.at, {
		reportId: sent.id,
		...(origin ? { origin } : {}),
		...(issue
			? { issue, issuePending: false }
			: unfiled === 'third-party'
				? {}
				: { issuePending: true }),
	});

	return {
		...(origin ? { origin } : {}),
		...(issue ? { issue } : {}),
		...(unfiled ? { unfiled } : {}),
		...(tweak ? { tweak } : {}),
	};
}

/**
 * @description Asks the server again to file crashes whose issue GitHub could not open last time, three per launch.
 */
export async function retryPendingIssues(): Promise<void> {
	const { readCrashHistory } = await import('~/diagnostics/crash-history');
	const pending = (await readCrashHistory())
		.flatMap((record) =>
			record.issuePending && record.reportId && !record.issue
				? [{ at: record.at, reportId: record.reportId }]
				: [],
		)
		.slice(-RETRIES_PER_LAUNCH);

	for (const record of pending) {
		const filed = await requestIssue(record.reportId);

		if (filed?.issue) {
			await markCrashReported(record.at, {
				issue: { number: filed.issue.number, url: filed.issue.url },
				issuePending: false,
			});
		}
	}
}

/**
 * @description Adds what the user wrote to the GitHub issue a sent crash report went to, through Unbound's server.
 * @param reportId The crash report's id.
 * @param note The note.
 * @returns Whether the server posted it on the issue.
 */
export async function addCrashNote(reportId: string, note: string): Promise<boolean> {
	try {
		const { createUnboundClient } = await import('~/account/client');
		const request = createUnboundClient();
		const { commented } = await request('POST /api/v1/crash-reports/$id/note', {
			params: { id: reportId },
			body: { note },
		});

		return commented;
	} catch (error) {
		logger.warn(`Failed to add a note to crash report ${reportId}:`, error);

		return false;
	}
}
