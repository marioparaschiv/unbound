import { createLogger } from '@unbound-app/logger';

import { buildCrashReport } from '~/diagnostics/crash-report';
import type { CrashEvent } from '~/diagnostics/crash-report';
import { getSetting, setSetting } from '~/settings/unbound';
import { currentEnvironment } from '~/core/environment';
import { getLoader } from '~/native/unbound-native';
import { UNBOUND_LOG } from '~/logs/files';
import fs from '~/native/fs';

export type { CrashEvent, CrashReportAddon } from '~/diagnostics/crash-report';

type CrashReportIssue = { number: number; created: boolean };

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

async function announceIssue({ number, created }: CrashReportIssue) {
	const { info } = await import('~/toasts/api');

	info(created ? 'UNBOUND_CRASH_REPORT_FILED' : 'UNBOUND_CRASH_REPORT_JOINED', { number });
}

async function consentToReport(event: CrashEvent): Promise<boolean> {
	if (crashReportsEnabled()) {
		return true;
	}

	const { askToReportCrash } = await import('~/diagnostics/crash-consent');

	return (await askToReportCrash(event.addon?.id)) !== 'declined';
}

async function sendCrashReport(
	event: CrashEvent,
	breadcrumbs: string[],
): Promise<string | undefined> {
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
				await crashContext(breadcrumbs),
			);

		if (!report) {
			return undefined;
		}

		const request = createUnboundClient();
		const { id, issue } = await request('POST /api/v1/crash-reports', {
			body: report,
		});

		if (issue) {
			await announceIssue(issue);
		}

		return id;
	} catch (error) {
		logger.warn(`Failed to send a ${event.kind} crash report:`, error);

		return undefined;
	}
}

/**
 * @description Sends a crash report when the user turned reporting on, and otherwise asks once per launch whether
 * to send it. Failures are logged and never thrown.
 * @param event The failure the manager saw.
 * @returns The report's id, or `undefined` when the user declined or the report was not sent.
 */
export async function reportCrash(event: CrashEvent): Promise<string | undefined> {
	if (!(await consentToReport(event))) {
		return undefined;
	}

	const { recentBreadcrumbs } = await import('~/diagnostics/breadcrumbs');

	return sendCrashReport(event, recentBreadcrumbs());
}

/**
 * @description Sends the previous launch's native crash once, asking first while reporting is off, and remembers the
 * report's id for `/debug`. A declined crash is not asked about again.
 * @param launch The loader's launch report.
 */
export async function reportNativeCrash(launch = getLoader()?.launch): Promise<void> {
	const stack = launch?.crashStack;
	const newest = launch?.crashes?.at(-1);

	if (!stack || !newest || getSetting('crash-reports.nativeAt') >= newest.at) {
		return;
	}

	const event: CrashEvent = { kind: 'native-crash', message: launch.lastCrash, stack };

	if (!(await consentToReport(event))) {
		setSetting('crash-reports.nativeAt', newest.at);

		return;
	}

	const { previousBreadcrumbs } = await import('~/diagnostics/breadcrumbs');
	const id = await sendCrashReport(event, await previousBreadcrumbs());

	if (!id) {
		return;
	}

	setSetting('crash-reports.nativeAt', newest.at);
	setSetting('crash-reports.lastId', id);
}
