import {
	DISCORD_TEAM_ID,
	type Diagnosis,
	type NotificationFacts,
} from '~/lib/notification-diagnosis';
import { COLOURS } from '~/lib/constants';

/** The two views of the notifications help; the button switches between them. */
export const HELP_VIEWS = ['simple', 'advanced'] as const;

export type HelpView = (typeof HELP_VIEWS)[number];

/** How a diagnosis reads at a glance: its heading, accent colour and certificate type; both views share it. */
export type DiagnosisLook = { heading: string; accent: number; cert?: string };

/** One view's text: a summary under the heading, then titled blocks, each its own text display. */
type Write = (facts: NotificationFacts) => string[];

type Instructions = DiagnosisLook & Record<HelpView, Write>;

const code = (value?: string) => `\`${value ?? 'unknown'}\``;

const block = (title: string, ...items: string[]) => [`**${title}**`, ...items].join('\n');

const WORKS_SUMMARY =
	'Good news: your copy of Discord is set up to get notifications. Something in your settings is holding them back.';

// What to check once notifications can reach the install.
const SETTINGS_CHECKS = block(
	'Check these',
	'1. iOS **Settings › Notifications › Discord** is on.',
	'2. No Focus mode is silencing Discord.',
	"3. In Discord, **Settings › Notifications** is on and the server isn't muted.",
	'-# Still nothing? Log out of Discord and back in.',
);

const PUSH_DETAILS = block(
	"If they still don't arrive",
	'- Log out and back in. That gives Discord a fresh push token.',
	"- Discord holds phone notifications while you're active on desktop. See **Settings › Notifications › Push Notification Inactive Timeout**.",
	'- Server and channel overrides win over the global setting.',
);

const PUSH_CERTIFICATE_FIX = block(
	'How to fix it',
	'1. Get a **distribution** certificate with **Push Notifications** turned on. Whoever gives you certificates can tell you if theirs has it.',
	'2. Sign Discord with it and reinstall.',
);

const INSTRUCTIONS: Record<Diagnosis, Instructions> = {
	android: {
		heading: 'Notifications on Android',
		accent: COLOURS.info,
		simple: () => [
			"Android doesn't need special signing for notifications, so the fix is almost always a setting.",
			block(
				'Check these',
				'1. **Settings › Apps › Discord › Notifications** is on.',
				'2. Battery use for Discord is set to **Unrestricted**.',
				"3. In Discord, **Settings › Notifications** is on and the server isn't muted.",
				'-# Still nothing? Log out of Discord and back in.',
			),
		],
		advanced: () => [
			"Android gets Discord's notifications through Google's Firebase Cloud Messaging, so a few things outside Discord can block them.",
			block(
				'Common causes',
				'- **No Google Play services** (GrapheneOS, de-Googled ROMs): nothing arrives. Install sandboxed Play services or microG.',
				'- **Battery managers** on Xiaomi, Huawei and Samsung kill the push connection. Allow autostart and turn off battery optimisation for Discord.',
				'- **A fresh reinstall** needs a log out and back in so Discord registers a new push token.',
			),
		],
	},
	'discord-signed': {
		heading: 'Notifications can work',
		accent: COLOURS.positive,
		cert: 'discord',
		simple: () => [WORKS_SUMMARY, SETTINGS_CHECKS],
		advanced: ({ push }) => [
			`Signed with Discord's own identity (\`${DISCORD_TEAM_ID}\`) and \`aps-environment\` is ${code(push)}, so Apple delivers to this install.`,
			PUSH_DETAILS,
		],
	},
	'discord-no-push': {
		heading: 'Notifications were left out of your install',
		accent: COLOURS.warning,
		cert: 'discord',
		simple: () => [
			"Your Discord was installed without the permission iOS needs for notifications, so it never signs up for them. That happened during the install, not in your settings, and it's quick to fix.",
			block(
				'How to fix it',
				'1. Reinstall Discord with TrollStore.',
				"2. Keep Discord's original entitlements when you install it.",
			),
		],
		advanced: ({ push }) => [
			`Signed with Discord's own identity (\`${DISCORD_TEAM_ID}\`), but \`aps-environment\` is ${code(push)}.`,
			block(
				'Why',
				"- TrollStore signs with whatever entitlements it's given, and this install lost the push one.",
			),
			block(
				'Fix',
				"- Reinstall keeping the IPA's own entitlements, or add `aps-environment` = `production` to the ones you supply.",
			),
		],
	},
	'distribution-push': {
		heading: 'Notifications can work',
		accent: COLOURS.positive,
		cert: 'distribution',
		simple: () => [WORKS_SUMMARY, SETTINGS_CHECKS],
		advanced: ({ team, push }) => [
			`Signed with a distribution certificate from team ${code(team)} and \`aps-environment\` is ${code(push)}, so Apple delivers to this install.`,
			PUSH_DETAILS,
		],
	},
	'distribution-no-push': {
		heading: 'Push is off in your certificate',
		accent: COLOURS.danger,
		cert: 'distribution',
		simple: () => [
			"The certificate your Discord was signed with doesn't have notifications turned on, so iOS never signs Discord up for them. No setting on your phone can change that, so you haven't missed anything.",
			PUSH_CERTIFICATE_FIX,
		],
		advanced: ({ team }) => [
			`Distribution certificate from team ${code(team)}, with no \`aps-environment\` entitlement.`,
			block(
				'What push needs',
				"- An explicit App ID with the Push Notifications capability. Wildcard App IDs (`com.example.*`) can't have it.",
				'- A profile for that App ID. Signing with it gives the install `aps-environment` = `production`.',
				'-# On a PPQ certificate, keep a changed bundle ID. Apple can flag the account for signing the App Store one, `com.hammerandchisel.discord`.',
			),
		],
	},
	development: {
		heading: "Development certificates can't get notifications",
		accent: COLOURS.danger,
		cert: 'development',
		simple: () => [
			"Your Discord is signed with a development certificate. Those are handy for things like JIT, but Discord's notifications never reach them. It's a limit of the certificate, not your settings.",
			PUSH_CERTIFICATE_FIX,
		],
		advanced: ({ team, push }) => [
			`Development certificate from team ${code(team)}, \`aps-environment\` is ${code(push)}.`,
			block(
				'Why',
				'- Development signing sets `get-task-allow`, which is what allows JIT.',
				"- Its push tokens only work with Apple's sandbox server, and Discord only sends to the production one.",
				'- Free and SideStore-style certificates also expire after 7 days unless the account is grandfathered.',
			),
			block(
				'Fix',
				'- Sign with a distribution certificate whose profile has the Push Notifications capability. The install then gets `aps-environment` = `production`.',
			),
		],
	},
	livecontainer: {
		heading: "LiveContainer can't get notifications",
		accent: COLOURS.danger,
		cert: 'livecontainer',
		simple: () => [
			"Discord is running inside LiveContainer, so it borrows LiveContainer's signature instead of having its own. That signature can't receive Discord's notifications.",
			block(
				'How to fix it',
				'1. Install Discord as its own app, outside LiveContainer.',
				'2. Sign it with a distribution certificate that has **Push Notifications** turned on.',
			),
		],
		advanced: ({ team, push }) => [
			`Running inside LiveContainer: team ${code(team)}, \`aps-environment\` is ${code(push)}.`,
			block(
				'Why',
				'- Apps inside LiveContainer share its signature and entitlements.',
				'- LiveContainer is usually development-signed, so it gets sandbox pushes or none.',
			),
			block(
				'Fix',
				"- Install Discord on its own with a push-enabled distribution certificate, or with TrollStore keeping Discord's entitlements.",
			),
		],
	},
	unreadable: {
		heading: "I couldn't read how Discord is signed",
		accent: COLOURS.muted,
		cert: 'unknown',
		simple: () => [
			"Your report didn't include the signing details I need, so I can't tell yet whether notifications can work. This happens now and then, and it's nothing you did.",
			block(
				'What to try',
				'1. Ask about notifications in the server again.',
				'2. Run `/debug` when I DM you.',
			),
		],
		advanced: () => [
			"The report had no entitlements, so I can't tell the certificate type or `aps-environment`.",
			block(
				'Why',
				"- The loader reads entitlements from the kernel first, then from the app's executable. Empty means both reads failed.",
			),
			block('Next', '- Run `/debug log:true` so the log shows which read failed.'),
		],
	},
};

/**
 * @description Writes the notifications help for a diagnosis in one view.
 * @param view `simple` for everyone, `advanced` for the entitlements and the reasoning.
 * @param facts The diagnosis, with the team and push environment it rests on.
 * @returns The summary, then each titled block, as Markdown.
 */
export function writeInstructions(view: HelpView, facts: NotificationFacts): string[] {
	return INSTRUCTIONS[facts.diagnosis][view](facts);
}

/**
 * @description Looks up the heading, accent and certificate type a diagnosis shows in both views.
 * @param diagnosis The diagnosis.
 * @returns Its look.
 */
export function diagnosisLook(diagnosis: Diagnosis): DiagnosisLook {
	const { heading, accent, cert } = INSTRUCTIONS[diagnosis];

	return { heading, accent, cert };
}

export default { writeInstructions, diagnosisLook };
