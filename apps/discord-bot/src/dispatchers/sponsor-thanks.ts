import { ButtonStyle, ComponentType, type RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { createLogger } from '@unbound-app/logger';

import { discordFailure, type MessageGateway } from '~/lib/discord-messages';
import { COLOURS, EMOJIS } from '~/lib/constants';

const logger = createLogger('Bot', 'SponsorThanks');

/**
 * @description Renders the DM a sponsor gets once their Sponsor role is granted: thanks, and where to redeem their perks.
 * @param siteUrl The site origin the account page link points at.
 * @returns The message body to send.
 */
export function renderSponsorThanks(siteUrl: string): RESTPostAPIChannelMessageJSONBody {
	const url = `${siteUrl}/account`;
	const { heart } = EMOJIS;

	return {
		embeds: [
			{
				title: 'Thank you for sponsoring Unbound',
				url,
				description: `<:${heart.name}:${heart.id}> Your support means a lot and helps keep Unbound going. As a small thank-you, you now have the Sponsor role.\n\nYour perks are waiting for you on your [account page](${url}).`,
				color: COLOURS.brand,
			},
		],
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Link,
						label: 'Redeem your perks',
						// The heart of the account page's sponsor button; Discord adds the external-link glyph itself.
						emoji: heart,
						url,
					},
				],
			},
		],
		allowed_mentions: { parse: [] },
	};
}

/**
 * @description DMs a newly granted sponsor their thanks; a failed DM is logged and never retried.
 * @param messages The bot's Discord messages.
 * @param siteUrl The site origin the account page link points at.
 * @param discordId The sponsor's Discord id.
 */
export async function thankSponsor(
	messages: MessageGateway,
	siteUrl: string,
	discordId: string,
): Promise<void> {
	try {
		await messages.dm(
			discordId,
			{ body: renderSponsorThanks(siteUrl) },
			{ nonce: `s${discordId}` },
		);
		logger.info(`Thanked sponsor ${discordId} by DM.`);
	} catch (error) {
		// A sponsor who closes their DMs to the bot still keeps the role.
		if (discordFailure(error) === 'undeliverable') {
			logger.debug(`Sponsor ${discordId} does not accept DMs from the bot; not thanked.`);

			return;
		}

		logger.error(`Failed to thank sponsor ${discordId}:`, error);
	}
}

export default { renderSponsorThanks, thankSponsor };
