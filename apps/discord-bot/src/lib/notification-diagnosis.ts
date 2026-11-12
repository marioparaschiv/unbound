import { safeParse, Type, type StaticDecode } from '@unbound-app/contracts/schema';
import { unpackDebugAltText } from '@unbound-app/contracts/debug-card-alt-text';
import type { PlistValue } from '@unbound-app/contracts/plist';

/** The team Discord signs its own iOS builds with; the loader's `kDiscordTeamIdentifier`. */
export const DISCORD_TEAM_ID = '53Q6R32WPB';

/** Discord's App ID: the identity APNs delivers Discord's pushes to. */
export const DISCORD_APP_ID = `${DISCORD_TEAM_ID}.com.hammerandchisel.discord`;

/** Why notifications do or do not reach the asker's install, read from their `/debug` report. */
export const DIAGNOSES = [
	'android',
	'discord-signed',
	'discord-no-push',
	'distribution-push',
	'distribution-no-push',
	'development',
	'livecontainer',
	'unreadable',
] as const;

export type Diagnosis = (typeof DIAGNOSES)[number];

/**
 * What the `/debug` entitlements say about push: the signing team and `aps-environment`, `none` when absent.
 * `appId` is the bundle part of a wildcard App ID, which cannot have push.
 */
export type NotificationFacts = {
	diagnosis: Diagnosis;
	team?: string;
	push?: string;
	appId?: string;
};

// Only the keys the diagnosis reads; the plist's other keys pass through unchecked.
const entitlementsSchema = Type.Object({
	'application-identifier': Type.Optional(Type.String()),
	'com.apple.developer.team-identifier': Type.Optional(Type.String()),
	'aps-environment': Type.Optional(Type.String()),
	'get-task-allow': Type.Optional(Type.Boolean()),
});

// The alt text carries the whole report; these are the fields the diagnosis reads.
const payloadSchema = Type.Object({
	unbound: Type.String(),
	platform: Type.String(),
	install: Type.Optional(Type.String()),
	source: Type.Optional(Type.String()),
	entitlements: Type.Optional(entitlementsSchema),
});

export type DebugPayload = StaticDecode<typeof payloadSchema>;

export type Entitlements = StaticDecode<typeof entitlementsSchema>;

const NOTIFICATION_WORD = /\bnotif(?:ication)?s?\b/i;
// The loader writes the signing as `Development (ABCDE12345) · …`, with or without backticks.
const INSTALL_TEAM = /^\w[\w ]*\(`?(\w{10})`?\)/;
const TEXT_REPORT_HEADING = '### Unbound Debug Info';
const LIVECONTAINER = /livecontainer/i;
const DEVELOPMENT_INSTALL = /^Development\b/;

function textField(content: string, label: string): string | undefined {
	return new RegExp(String.raw`^- \*\*${label}:\*\* (.+)$`, 'm').exec(content)?.[1]?.trim();
}

/**
 * @description Tells whether a message asks about notifications.
 * @param text The message's content.
 * @returns Whether it mentions notifications.
 */
export function isNotificationQuestion(text: string): boolean {
	return NOTIFICATION_WORD.test(text);
}

/**
 * @description Reads the report Unbound's `/debug` card packs into its alt text.
 * @param altText An image attachment's description.
 * @returns The report, or `undefined` when the text is not one.
 */
export function readDebugPayload(altText: string): DebugPayload | undefined {
	// Cards drawn before packing carry the report as plain JSON.
	const json = unpackDebugAltText(altText) ?? altText;

	try {
		const parsed = safeParse(payloadSchema, JSON.parse(json));

		return parsed.success ? parsed.data : undefined;
	} catch {
		// Not JSON: a damaged card, treated as no report.
		return undefined;
	}
}

/**
 * @description Reads the Markdown report `/debug` sends when it cannot draw the card.
 * @param content The message's content.
 * @returns The fields the diagnosis reads, or `undefined` when the message is not a report.
 */
export function readTextReport(content: string): DebugPayload | undefined {
	const unbound = textField(content, 'Unbound');
	const device = textField(content, 'Device');

	if (!content.startsWith(TEXT_REPORT_HEADING) || !unbound || !device) {
		return undefined;
	}

	return {
		unbound,
		platform: / on Android\b/.test(device) ? 'Android' : 'iOS',
		install: textField(content, 'Install'),
		source: textField(content, 'Discord'),
	};
}

/**
 * @description Reads the keys the diagnosis needs from an entitlements plist parsed to JSON.
 * @param plist The parsed plist.
 * @returns The entitlements, or `undefined` when the plist is not a dictionary of them.
 */
export function readEntitlements(plist?: PlistValue): Entitlements | undefined {
	const parsed = safeParse(entitlementsSchema, plist);

	return parsed.success ? parsed.data : undefined;
}

function classify(payload: DebugPayload, entitlements?: Entitlements): NotificationFacts {
	if (payload.platform.toLowerCase() === 'android') {
		return { diagnosis: 'android' };
	}

	const appId = entitlements?.['application-identifier'];
	const team =
		entitlements?.['com.apple.developer.team-identifier'] ??
		appId?.split('.')[0] ??
		INSTALL_TEAM.exec(payload.install ?? '')?.[1];
	const push = entitlements ? (entitlements['aps-environment'] ?? 'none') : undefined;

	if (!team) {
		return { diagnosis: 'unreadable', push };
	}

	// TrollStore signs with any entitlements: Discord's identity still needs the production push entitlement.
	if (appId === DISCORD_APP_ID || (!appId && team === DISCORD_TEAM_ID)) {
		const pushes = push === undefined || push === 'production';

		return { diagnosis: pushes ? 'discord-signed' : 'discord-no-push', team, push };
	}

	if (LIVECONTAINER.test(appId ?? '') || LIVECONTAINER.test(payload.source ?? '')) {
		return { diagnosis: 'livecontainer', team, push };
	}

	// `get-task-allow` comes from the certificate type; without entitlements the loader's label says the same.
	const development = entitlements
		? entitlements['get-task-allow'] === true || push === 'development'
		: DEVELOPMENT_INSTALL.test(payload.install ?? '');

	if (development) {
		return { diagnosis: 'development', team, push };
	}

	if (push === undefined) {
		return { diagnosis: 'unreadable', team };
	}

	return {
		diagnosis: push === 'production' ? 'distribution-push' : 'distribution-no-push',
		team,
		push,
	};
}

/**
 * @description Decides why notifications do or do not reach an install, from its `/debug` report and entitlements.
 * @param payload The report.
 * @param entitlements The entitlements, when the report did not carry them; without either the team comes from `install`.
 * @returns The diagnosis, with the team, push environment and wildcard App ID it rests on.
 */
export function diagnoseNotifications(
	payload: DebugPayload,
	entitlements = payload.entitlements,
): NotificationFacts {
	const facts = classify(payload, entitlements);
	const appId = entitlements?.['application-identifier'];

	if (facts.diagnosis === 'android' || !appId?.endsWith('*')) {
		return facts;
	}

	return { ...facts, appId: appId.slice(appId.indexOf('.') + 1) };
}

export default {
	DISCORD_TEAM_ID,
	DISCORD_APP_ID,
	DIAGNOSES,
	isNotificationQuestion,
	readDebugPayload,
	readTextReport,
	readEntitlements,
	diagnoseNotifications,
};
