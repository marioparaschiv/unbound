import { ButtonStyle, ComponentType } from 'discord.js';

import { containerMessage, separator, textDisplay } from '~/lib/container-message';
import type { ContainerMessage } from '~/lib/container-message';
import { COLOURS } from '~/lib/constants';

/** How long the bot waits for a reaction or a `/debug`; the prompts name the same window. */
export const ASK_TTL_MS = 5 * 60 * 1000;

const MINUTES = `**${ASK_TTL_MS / 60_000} minutes**`;

/** The reaction the asker adds once their DMs are open; the bot adds it first so it is one tap. */
export const OPEN_DMS_EMOJI = '✅';

/** What the asker asked about; each topic's help reads the same `/debug` report. */
export const HELP_TOPICS = ['notifications', 'screen-share'] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

/** How the prompts name a topic: in a heading, as the thing to sort out, and to ask about again. */
type TopicWords = { heading: string; trouble: string; subject: string; name: string };

const TOPICS: Record<HelpTopic, TopicWords> = {
	notifications: {
		heading: "Let's check your notifications",
		trouble: "Sorry they're giving you trouble. Whether they can work",
		subject: 'your notifications',
		name: 'notifications',
	},
	'screen-share': {
		heading: "Let's check screen share",
		trouble: "Sorry it's giving you trouble. Whether it can work",
		subject: 'screen share',
		name: 'screen share',
	},
};

/**
 * @description The DM that asks for `/debug`: what the bot needs before it can say anything specific.
 * @param topic What the asker asked about.
 * @returns The message options.
 */
export function askForDebug(topic: HelpTopic): ContainerMessage {
	const { heading, trouble } = TOPICS[topic];

	return containerMessage(COLOURS.brand, [
		textDisplay(
			[
				`### ${heading}`,
				`${trouble} depends on how your copy of Discord was installed and signed, so I'll look at that first.`,
			].join('\n'),
		),
		separator(),
		textDisplay(
			[
				'**What I need from you**',
				`Run Unbound's \`/debug\` command right here within the next ${MINUTES}. I'll read the report and reply with the fix for your setup.`,
				'-# The report lists your Unbound, Discord and device versions and how the app is signed. Nothing from your account.',
			].join('\n'),
		),
	]);
}

/**
 * @description The reply in the server once the DM is sent, with a button that opens it.
 * @param dmChannelId The DM channel the ask went to.
 * @param topic What the asker asked about.
 * @returns The message options.
 */
export function dmSentMessage(dmChannelId: string, topic: HelpTopic): ContainerMessage {
	return containerMessage(COLOURS.info, [
		{
			type: ComponentType.Section,
			components: [
				textDisplay(
					`**Check your DMs.** I've sent you a message so we can sort out ${TOPICS[topic].subject}.`,
				),
			],
			accessory: {
				type: ComponentType.Button,
				style: ButtonStyle.Link,
				label: 'Open DM',
				url: `https://discord.com/channels/@me/${dmChannelId}`,
			},
		},
	]);
}

/**
 * @description The reply in the server when the DM bounces, or bounces again after the asker reacted.
 * @param guildName The server's name, where the DM setting lives.
 * @param topic What the asker asked about.
 * @param retry Whether the asker already reacted once.
 * @returns The message options.
 */
export function openDmsPrompt(
	guildName: string,
	topic: HelpTopic,
	retry = false,
): ContainerMessage {
	const intro = retry
		? [
				'### Your DMs still look closed',
				"No worries, that setting is easy to miss. Give it one more look and I'll try again.",
			]
		: [
				"### I can't DM you",
				`I'd like to help with ${TOPICS[topic].subject} in a DM, but your DMs from this server are closed.`,
			];
	const react = retry
		? `3. React with ${OPEN_DMS_EMOJI} below again.`
		: `3. React with ${OPEN_DMS_EMOJI} below within ${MINUTES}.`;

	return containerMessage(COLOURS.warning, [
		textDisplay(intro.join('\n')),
		textDisplay(
			[
				'**How to open them**',
				`1. Tap **${guildName}** › **Privacy Settings**.`,
				'2. Turn on **Direct Messages**.',
				react,
				`-# You can turn DMs off again afterwards. Only your ${OPEN_DMS_EMOJI} counts.`,
			].join('\n'),
		),
	]);
}

/**
 * @description Shown once the asker stops answering.
 * @param topic What the asker asked about.
 * @returns The message options.
 */
export function openDmsExpired(topic: HelpTopic): ContainerMessage {
	return containerMessage(COLOURS.warning, [
		textDisplay(
			[
				'### This timed out',
				`No problem. Ask about ${TOPICS[topic].name} again whenever your DMs are open and I'll pick it back up.`,
			].join('\n'),
		),
	]);
}

export default { HELP_TOPICS, askForDebug, dmSentMessage, openDmsPrompt, openDmsExpired };
