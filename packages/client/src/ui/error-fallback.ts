/** Where a crash is reported: the monorepo's issue form, pre-filled. */
export const ISSUES_URL = 'https://github.com/marioparaschiv/unbound/issues/new';

const MAX_REPORT_LENGTH = 6000;

export type CaughtError = {
	error: Error;
	componentStack?: string;
};

export type ReportContext = {
	clientVersion: string;
	platform: string;
};

function nameOf(error: Error): string {
	return error?.name || 'Error';
}

/**
 * @description Formats a caught error for the clipboard and bug reports: its name and message, then both stacks.
 * @param caught The error and the component stack React reported with it.
 * @returns The plain-text report.
 */
export function describeError({ error, componentStack }: CaughtError): string {
	const sections = [`${nameOf(error)}: ${error?.message ?? String(error)}`];

	if (error?.stack) {
		sections.push(`Stack trace:\n${error.stack}`);
	}

	if (componentStack?.trim()) {
		sections.push(`Component stack:${componentStack.trimEnd()}`);
	}

	return sections.join('\n\n');
}

/**
 * @description Builds a GitHub issue URL pre-filled with the crash, trimmed so the URL stays openable.
 * @param caught The error and its component stack.
 * @param context The client version and the OS it runs on.
 * @returns The new-issue URL.
 */
export function bugReportURL(caught: CaughtError, context: ReportContext): string {
	const details = describeError(caught).slice(0, MAX_REPORT_LENGTH);
	const body = [
		`**Unbound:** ${context.clientVersion}`,
		`**Platform:** ${context.platform}`,
		'',
		'**What happened before the crash:**',
		'',
		'',
		'```',
		details,
		'```',
	].join('\n');
	const title = `Crash: ${nameOf(caught.error)}: ${caught.error?.message ?? ''}`.slice(0, 120);

	return `${ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
