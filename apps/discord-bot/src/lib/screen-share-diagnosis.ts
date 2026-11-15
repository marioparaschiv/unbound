import { isLiveContainer, type DebugPayload } from '~/lib/notification-diagnosis';

/** Discord's screen share extension, by the name `/debug` lists extensions under. */
export const BROADCAST_EXTENSION = 'BroadcastUpload';

/** Why screen share does or does not work on the asker's install, read from their `/debug` report. */
export const SCREEN_SHARE_DIAGNOSES = [
	'android',
	'livecontainer',
	'no-app-group',
	'no-problem-found',
] as const;

export type ScreenShareDiagnosis = (typeof SCREEN_SHARE_DIAGNOSES)[number];

const SCREEN_SHARE_WORDS =
	/\bscreen ?(?:shar(?:e|es|ed|ing)|cast(?:s|ing)?)\b|\bshar(?:e|ing) (?:my |the |your )?screen\b|\bgo(?:ing)? live\b/i;

/**
 * @description Tells whether a message asks about screen sharing.
 * @param text The message's content.
 * @returns Whether it mentions screen share, sharing a screen or going live.
 */
export function isScreenShareQuestion(text: string): boolean {
	return SCREEN_SHARE_WORDS.test(text);
}

/**
 * @description Decides why screen share does or does not work on an install, from its `/debug` report and entitlements.
 * @param payload The report.
 * @param entitlements The app's entitlements, when the report did not carry them.
 * @returns The diagnosis; `no-problem-found` also covers loaders too old to report extensions.
 */
export function diagnoseScreenShare(
	payload: DebugPayload,
	entitlements = payload.entitlements,
): ScreenShareDiagnosis {
	if (payload.platform.toLowerCase() === 'android') {
		return 'android';
	}

	if (isLiveContainer(payload, entitlements)) {
		return 'livecontainer';
	}

	// The extension hands frames to Discord through the app group; with no group on the app, or the extension
	// signed outside it, the broadcast has nowhere to go.
	const groups = entitlements && (entitlements['com.apple.security.application-groups'] ?? []);

	if (groups?.length === 0 || payload.isolatedExtensions?.includes(BROADCAST_EXTENSION)) {
		return 'no-app-group';
	}

	return 'no-problem-found';
}

export default {
	BROADCAST_EXTENSION,
	SCREEN_SHARE_DIAGNOSES,
	isScreenShareQuestion,
	diagnoseScreenShare,
};
