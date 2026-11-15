import { ButtonStyle, ComponentType } from 'discord.js';
import { describe, expect, test } from 'bun:test';

import { renderSponsorThanks } from '~/dispatchers/sponsor-thanks';
import { COLOURS, EMOJIS } from '~/lib/constants';

describe('renderSponsorThanks', () => {
	test('thanks the sponsor and links the account page from the embed and a button', () => {
		const body = renderSponsorThanks('https://unbound.rip');
		const url = 'https://unbound.rip/account';

		expect(body.embeds).toEqual([
			{
				title: 'Thank you for sponsoring Unbound',
				url,
				description: expect.stringContaining(`[account page](${url})`),
				color: COLOURS.brand,
			},
		]);
		expect(body.components).toEqual([
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Link,
						label: 'Redeem your perks',
						emoji: EMOJIS.heart,
						url,
					},
				],
			},
		]);
		expect(body.allowed_mentions).toEqual({ parse: [] });
	});
});
