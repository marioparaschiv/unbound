import { BROADCAST_EXTENSION, type ScreenShareDiagnosis } from '~/lib/screen-share-diagnosis';
import { containerMessage, separator, textDisplay } from '~/lib/container-message';
import type { ContainerMessage } from '~/lib/container-message';
import { COLOURS } from '~/lib/constants';

/** One diagnosis's reply: a heading and accent, a summary under the heading, then titled blocks. */
type ScreenShareHelp = { heading: string; accent: number; summary: string; blocks: string[] };

const block = (title: string, ...items: string[]) => [`**${title}**`, ...items].join('\n');

const HELP: Record<ScreenShareDiagnosis, ScreenShareHelp> = {
	android: {
		heading: 'Screen share on Android',
		accent: COLOURS.info,
		summary:
			"Android doesn't need special signing for screen share, so the fix is almost always a permission or setting.",
		blocks: [
			block(
				'Check these',
				'1. When you go live, allow the **Start recording or casting** prompt.',
				'2. Battery use for Discord is set to **Unrestricted**.',
				'3. Discord and Unbound are up to date.',
				'-# Some apps, like banking and video streaming apps, block capture and show up black. That is the app, not Discord.',
			),
		],
	},
	livecontainer: {
		heading: "LiveContainer can't screen share",
		accent: COLOURS.danger,
		summary:
			"Discord is running inside LiveContainer, which can't run Discord's screen share extension. No setting can change that.",
		blocks: [
			block(
				'How to fix it',
				'1. Install Discord as its own app, outside LiveContainer.',
				'2. Keep its app extensions when you sign it.',
			),
		],
	},
	'no-app-group': {
		heading: "Screen share can't reach Discord",
		accent: COLOURS.warning,
		summary:
			"Discord's screen share extension was signed without your app's **App Group**, so it can't hand your screen to Discord. The broadcast stops right away or nobody sees it.",
		blocks: [
			block(
				'How to fix it',
				'1. Sign Discord with a certificate that supports **App Groups**, so the app and its extensions share one group.',
				'2. Reinstall Discord.',
				"-# TrollStore installs keep Discord's own group and are not affected.",
			),
		],
	},
	'no-problem-found': {
		heading: "Your install's signing looks fine for screen share",
		accent: COLOURS.positive,
		summary:
			"I couldn't find a signing problem, so a setting or a stripped extension is the likely cause.",
		blocks: [
			block(
				'Check these',
				'1. In a call, tap **Share Screen**, then **Start Broadcast**, and wait for the countdown.',
				'2. **Settings › Screen Time › Content & Privacy Restrictions › Content Restrictions › Screen Recording** is allowed.',
				'3. Long-press **Screen Recording** in Control Center. **Discord** should be in the list.',
				'-# Discord missing from that list? Your sideloader removed its extensions. Sign it again with app extensions kept, then reinstall.',
			),
		],
	},
};

/**
 * @description Renders the screen share help for a diagnosis.
 * @param diagnosis Why screen share does or does not work on the asker's install.
 * @returns The container message.
 */
export function renderScreenShareHelp(diagnosis: ScreenShareDiagnosis): ContainerMessage {
	const { heading, accent, summary, blocks } = HELP[diagnosis];

	return containerMessage(accent, [
		textDisplay(`### ${heading}\n${summary}`),
		...blocks.map(textDisplay),
		separator(),
		textDisplay(`-# \`screen share ${diagnosis}\` \`extension ${BROADCAST_EXTENSION}\``),
	]);
}

export default { renderScreenShareHelp };
