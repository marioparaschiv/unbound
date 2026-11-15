import { ButtonStyle, MessageFlags } from 'discord.js';
import { describe, expect, test } from 'bun:test';

import { askForDebug, dmSentMessage, openDmsExpired, openDmsPrompt } from '~/lib/debug-prompts';
import { COLOURS } from '~/lib/constants';

import { messageButtons, messageText } from '../helpers/container-message';

describe('debug prompts', () => {
	test('the DM ask is a brand container that names the window and the privacy note', () => {
		const ask = askForDebug('notifications');

		expect(ask.flags).toBe(MessageFlags.IsComponentsV2);
		expect(ask.components[0].accent_color).toBe(COLOURS.brand);
		expect(messageText(ask)).toStartWith("### Let's check your notifications");
		expect(messageText(ask)).toContain('**5 minutes**');
		expect(messageText(ask)).toContain('-# The report lists');
	});

	test('each prompt names the topic that was asked about', () => {
		expect(messageText(askForDebug('screen-share'))).toStartWith(
			"### Let's check screen share\nSorry it's giving you trouble. Whether it can work",
		);
		expect(messageText(dmSentMessage('1', 'screen-share'))).toContain('sort out screen share.');
		expect(messageText(openDmsPrompt('x', 'screen-share'))).toContain(
			'help with screen share in a DM',
		);
		expect(messageText(openDmsExpired('notifications'))).toContain(
			'Ask about notifications again',
		);
	});

	test('"Check your DMs" links to the DM channel', () => {
		const message = dmSentMessage('42', 'notifications');

		expect(message.components[0].accent_color).toBe(COLOURS.info);
		expect(messageButtons(message)).toEqual([
			{
				type: 2,
				style: ButtonStyle.Link,
				label: 'Open DM',
				url: 'https://discord.com/channels/@me/42',
			},
		]);
	});

	test('the open-DMs prompt names the server and says when DMs are still closed', () => {
		const first = messageText(openDmsPrompt('Unbound', 'notifications'));

		expect(first).toContain("### I can't DM you");
		expect(first).toContain('1. Tap **Unbound** › **Privacy Settings**.');
		expect(first).toContain('-# You can turn DMs off again afterwards. Only your ✅ counts.');
		expect(messageText(openDmsPrompt('Unbound', 'notifications', true))).toContain(
			'still look closed',
		);
		expect(openDmsPrompt('Unbound', 'notifications').components[0].accent_color).toBe(
			COLOURS.warning,
		);
	});

	test('every prompt carries no content, so edits between them stay valid', () => {
		for (const message of [
			askForDebug('notifications'),
			dmSentMessage('1', 'notifications'),
			openDmsPrompt('x', 'notifications'),
			openDmsExpired('notifications'),
		]) {
			expect(message).not.toHaveProperty('content');
			expect(message.flags).toBe(MessageFlags.IsComponentsV2);
		}
	});
});
