import { crashReportResponseSchema } from '@unbound-app/contracts/crash-reports';
import { createApiClient } from '@unbound-app/web/client';
import { createLogger } from '@unbound-app/logger';
import type { Api } from '@unbound-app/web/api';

import { currentEnvironment } from '~/lib/environment';
import { buildCrashReport } from '~/lib/crash-report';
import type { CrashEvent } from '~/lib/crash-report';
import { getSetting } from '~/lib/unbound-settings';
import fs from '~/api/fs';

export type { CrashEvent, CrashReportAddon } from '~/lib/crash-report';

const logger = createLogger('Crash Reports');

const LOG_FILE = 'Unbound/Logs/unbound.log';

/**
 * @description Reads whether the user turned crash reporting on. It is off until they do.
 * @returns Whether reports may be sent.
 */
function crashReportsEnabled(): boolean {
	return getSetting('crash-reports');
}

async function readLoaderLog(): Promise<string | undefined> {
	try {
		return (await fs.exists(LOG_FILE)) ? await fs.read(LOG_FILE) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * @description Sends a crash report when the user turned reporting on. Failures are logged and never thrown.
 * @param event The failure the manager saw.
 */
export async function reportCrash(event: CrashEvent): Promise<void> {
	if (!crashReportsEnabled()) {
		return;
	}

	try {
		const { API_URL, CLIENT_VERSION } = await import('~/lib/constants');
		const environment = currentEnvironment(CLIENT_VERSION);
		const report = environment && buildCrashReport(event, environment, await readLoaderLog());

		if (!report) {
			return;
		}

		const request = createApiClient<Api>({ baseUrl: API_URL });

		await request('POST /api/v1/crash-reports', {
			body: report,
			response: crashReportResponseSchema,
		});
	} catch (error) {
		logger.warn('Could not send a crash report:', error);
	}
}
