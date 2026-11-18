import noop from '@unbound-app/utils/noop';

import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';

import { startAppSession, stopAppSession } from './app-session';
import { setRejectionTracker } from './promise-rejections';
import { recordError } from './recent-errors';

type ErrorHandler = ReturnType<typeof ErrorUtils.getGlobalHandler>;

let previousHandler: ErrorHandler | undefined;

/**
 * Takes Hermes' rejection tracker back once Discord's main module has run, and records uncaught errors for
 * `/debug` before React Native's handler sees them. Discord replaces the tracker installed before its bundle.
 */
export function start() {
	setRejectionTracker();
	startAppSession();
	void import('./breadcrumbs').then(({ startBreadcrumbs }) => startBreadcrumbs());
	void import('./crash-reports').then(
		async ({ reportNativeCrash, reportSystemHang, retryPendingIssues }) => {
			await reportNativeCrash();
			await reportSystemHang();
			await retryPendingIssues();
		},
	);

	if (typeof ErrorUtils === 'undefined') {
		return;
	}

	previousHandler = ErrorUtils.getGlobalHandler();

	const forward = previousHandler;

	ErrorUtils.setGlobalHandler((error, isFatal) => {
		recordError(error);
		forward(error, isFatal);
	});
}

/** Stops logging rejections; Hermes cannot remove a tracker, so a silent one replaces it. */
export function stop() {
	setRejectionTracker(noop);
	stopAppSession();
	void import('./breadcrumbs').then(({ stopBreadcrumbs }) => stopBreadcrumbs());

	if (!previousHandler) {
		return;
	}

	ErrorUtils.setGlobalHandler(previousHandler);
	previousHandler = undefined;
}

/** The hidden Recent Crashes page, opened from the General page. */
export const crashesSection: SectionEntry = {
	key: Screens.Crashes,
	titleKey: 'UNBOUND_RECENT_CRASHES',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/crashes').default,
	hidden: true,
};

export default { start, stop };
