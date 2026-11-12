import { ButtonStyle, ComponentType } from 'discord.js';

import { containerMessage, separator, textDisplay } from '~/lib/container-message';
import type { ContainerMessage } from '~/lib/container-message';
import { COLOURS } from '~/lib/constants';

/** How long the bot waits for a reaction or a `/debug`; the prompts name the same window. */
export const ASK_TTL_MS = 5 * 60 * 1000;

const MINUTES = `**${ASK_TTL_MS / 60_000} minutes**`;

/** The reaction the asker adds once their DMs are open; the bot adds it first so it is one tap. */
export const OPEN_DMS_EMOJI = '✅';

/** Sent by DM: what the bot needs before it can say anything specific. */
export const ASK_FOR_DEBUG: ContainerMessage = containerMessage(COLOURS.brand, [
	textDisplay(
		[
			"### Let's check your notifications",
			"Sorry they're giving you trouble. Whether they can work depends on how your copy of Discord was installed and signed, so I'll look at that first.",
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

/**
 * @description The reply in the server once the DM is sent, with a button that opens it.
 * @param dmChannelId The DM channel the ask went to.
 * @returns The message options.
 */
export function dmSentMessage(dmChannelId: string): ContainerMessage {
	return containerMessage(COLOURS.info, [
		{
			type: ComponentType.Section,
			components: [
				textDisplay(
					"**Check your DMs.** I've sent you a message so we can sort out your notifications.",
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
 * @param retry Whether the asker already reacted once.
 * @returns The message options.
 */
export function openDmsPrompt(guildName: string, retry = false): ContainerMessage {
	const intro = retry
		? [
				'### Your DMs still look closed',
				"No worries, that setting is easy to miss. Give it one more look and I'll try again.",
			]
		: [
				"### I can't DM you",
				"I'd like to help with your notifications in a DM, but your DMs from this server are closed.",
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

/** Shown once the asker stops answering. */
export const OPEN_DMS_EXPIRED: ContainerMessage = containerMessage(COLOURS.warning, [
	textDisplay(
		[
			'### This timed out',
			"No problem. Ask about notifications again whenever your DMs are open and I'll pick it back up.",
		].join('\n'),
	),
]);

export default { ASK_FOR_DEBUG, dmSentMessage, openDmsPrompt, OPEN_DMS_EXPIRED };
