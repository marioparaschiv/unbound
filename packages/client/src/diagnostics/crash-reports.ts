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

/**
 * @description Sends a crash report when the user turned reporting on. Failures are logged and never thrown.
 * @param event The failure the manager saw.
 * @returns The report's id, or `undefined` when reporting is off or the report was not sent.
 */
export async function reportCrash(event: CrashEvent): Promise<string | undefined> {
	if (!crashReportsEnabled()) {
		return undefined;
	}

	try {
		const { CLIENT_VERSION } = await import('~/core/constants');
		const { createUnboundClient } = await import('~/account/client');
		const environment = currentEnvironment(CLIENT_VERSION);
		const report = environment && buildCrashReport(event, environment, await readLoaderLog());

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
 * @description Sends the previous launch's native crash once, when the user turned reporting on, and remembers the
 * report's id for `/debug`.
 * @param launch The loader's launch report.
 */
export async function reportNativeCrash(launch = getLoader()?.launch): Promise<void> {
	const stack = launch?.crashStack;
	const newest = launch?.crashes?.at(-1);

	if (
		!stack ||
		!newest ||
		!crashReportsEnabled() ||
		getSetting('crash-reports.nativeAt') >= newest.at
	) {
		return;
	}

	const id = await reportCrash({ kind: 'native-crash', message: launch.lastCrash, stack });

	if (!id) {
		return;
	}

	setSetting('crash-reports.nativeAt', newest.at);
	setSetting('crash-reports.lastId', id);
}
