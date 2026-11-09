import { debugLines, type DebugInfo } from '~/diagnostics/format-debug-info';

/** Where a crash is reported: the monorepo's issue form, pre-filled. */
export const ISSUES_URL = 'https://github.com/marioparaschiv/unbound/issues/new';

const MAX_REPORT_LENGTH = 6000;
/** Discord's message limit without Nitro, so the diagnostics paste into a DM in one message. */
const MAX_DIAGNOSTICS_LENGTH = 2000;
const CRASH_REPORT_FORM = 'crash-report.yml';
const PLATFORM_NAMES: Record<string, string> = { ios: 'iOS', android: 'Android' };

export type CaughtError = {
	error: Error;
	componentStack?: string;
};

/** An enabled plugin as the crash diagnostics list it. */
export type CrashPlugin = {
	id: string;
	version: string;
	failed: boolean;
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
 * @description Names the OS React Native reports the way people write it.
 * @param platform `Platform.OS`, such as `ios`.
 * @returns `iOS` or `Android`, or the platform as given.
 */
export function platformName(platform: string): string {
	return PLATFORM_NAMES[platform.toLowerCase()] ?? platform;
}

/**
 * @description Drops each frame's location, which in a bundle is only a long path and offset, and its indent, so the screen shows the call chain.
 * @param stack An error's stack or a React component stack.
 * @returns The trimmed stack with every `at fn (location)` frame cut to `at fn`.
 */
export function readableStack(stack: string): string {
	return stack
		.trim()
		.replace(/(at \S+) \(.*\)/g, '$1')
		.replace(/^[ \t]+/gm, '');
}

/**
 * @description Lists the enabled plugins as one Markdown bullet, each as `id@version`, marking any that failed to start.
 * @param plugins The enabled plugins.
 * @param recovery Whether Discord runs in recovery mode, where no plugin runs.
 * @returns The bullet.
 */
export function pluginsLine(plugins: CrashPlugin[], recovery: boolean): string {
	if (recovery) {
		return '- **Plugins:** none, recovery mode';
	}

	const listed = plugins.map(
		({ id, version, failed }) => `\`${id}@${version}\`${failed ? ' (failed)' : ''}`,
	);

	return `- **Plugins (${plugins.length}):** ${listed.join(', ') || 'none'}`;
}

/**
 * @description Formats a crash for pasting into a DM or a GitHub issue: the versions, device and enabled plugins, the
 * error, then both stacks without their locations in a code block, trimmed to fit one Discord message.
 * @param caught The error and its component stack.
 * @param info The versions and device details `/debug` reports.
 * @param plugins The bullet {@link pluginsLine} builds.
 * @returns The Markdown text.
 */
export function crashDiagnostics(
	{ error, componentStack }: CaughtError,
	info: DebugInfo,
	plugins: string,
): string {
	const head = [
		'### Unbound Crash',
		...debugLines(info),
		plugins,
		'',
		`**${nameOf(error)}:** ${error?.message ?? String(error)}`,
	].join('\n');
	const stacks = [
		error?.stack ? `Stack trace:\n${readableStack(error.stack)}` : '',
		componentStack?.trim() ? `Component stack:\n${readableStack(componentStack)}` : '',
	].filter(Boolean);

	if (!stacks.length) {
		return head;
	}

	const room = Math.max(0, MAX_DIAGNOSTICS_LENGTH - head.length - '\n```\n\n```'.length);

	let body = stacks.join('\n\n');

	// Cut whole lines, so the last frame in the message is never half a name.
	if (body.length > room) {
		body = body.slice(0, body.lastIndexOf('\n', room));
	}

	return `${head}\n\`\`\`\n${body.trimEnd()}\n\`\`\``;
}

/**
 * @description Builds a GitHub issue URL pre-filled with the crash, trimmed so the URL stays openable.
 * @param caught The error and its component stack.
 * @param context The client version and the OS it runs on.
 * @returns The new-issue URL.
 */
export function bugReportURL(caught: CaughtError, context: ReportContext): string {
	const platform = platformName(context.platform);
	const query = new URLSearchParams({
		template: CRASH_REPORT_FORM,
		title: `crash: ${nameOf(caught.error)}: ${caught.error?.message ?? ''}`.slice(0, 120),
		platform,
		environment: `- **Unbound:** ${context.clientVersion}\n- **Platform:** ${platform}`,
		error: describeError(caught).slice(0, MAX_REPORT_LENGTH),
	});

	return `${ISSUES_URL}?${query.toString()}`;
}
