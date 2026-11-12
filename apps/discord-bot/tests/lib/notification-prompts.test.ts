import { ButtonStyle, MessageFlags } from 'discord.js';
import { describe, expect, test } from 'bun:test';

import {
	ASK_FOR_DEBUG,
	dmSentMessage,
	OPEN_DMS_EXPIRED,
	openDmsPrompt,
} from '~/lib/notification-prompts';
import { COLOURS } from '~/lib/constants';

import { messageButtons, messageText } from '../helpers/container-message';

describe('notification prompts', () => {
	test('the DM ask is a brand container that names the window and the privacy note', () => {
		expect(ASK_FOR_DEBUG.flags).toBe(MessageFlags.IsComponentsV2);
		expect(ASK_FOR_DEBUG.components[0].accent_color).toBe(COLOURS.brand);
		expect(messageText(ASK_FOR_DEBUG)).toStartWith("### Let's check your notifications");
		expect(messageText(ASK_FOR_DEBUG)).toContain('**5 minutes**');
		expect(messageText(ASK_FOR_DEBUG)).toContain('-# The report lists');
	});

	test('"Check your DMs" links to the DM channel', () => {
		const message = dmSentMessage('42');

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
		const first = messageText(openDmsPrompt('Unbound'));

		expect(first).toContain("### I can't DM you");
		expect(first).toContain('1. Tap **Unbound** › **Privacy Settings**.');
		expect(first).toContain('-# You can turn DMs off again afterwards. Only your ✅ counts.');
		expect(messageText(openDmsPrompt('Unbound', true))).toContain('still look closed');
		expect(openDmsPrompt('Unbound').components[0].accent_color).toBe(COLOURS.warning);
	});

	test('every prompt carries no content, so edits between them stay valid', () => {
		for (const message of [
			ASK_FOR_DEBUG,
			dmSentMessage('1'),
			openDmsPrompt('x'),
			OPEN_DMS_EXPIRED,
		]) {
			expect(message).not.toHaveProperty('content');
			expect(message.flags).toBe(MessageFlags.IsComponentsV2);
		}
	});
});
