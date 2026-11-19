import { embedChannel } from '~/lib/channels';
import type { StreamStatus } from '~/lib/status';

export type RawEmbed = { url?: string; provider?: { name?: string; url?: string } };

const SEPARATOR = ' · ';
const PROVIDER = 'Twitch';

/**
 * @description Writes each Twitch channel embed's stream status after its provider name, replacing any status written before.
 * @param embeds The message's raw embeds.
 * @param statusOf The known status of a channel, or `undefined` while it is unknown.
 * @param label Turns a status into the text shown.
 * @returns The embeds, with a status on each Twitch channel embed whose status is known.
 */
export function decorateEmbeds(
	embeds: RawEmbed[],
	statusOf: (channel: string) => StreamStatus | undefined,
	label: (status: StreamStatus) => string,
): RawEmbed[] {
	return embeds.map((embed) => {
		const channel = embedChannel(embed.url);
		const status = channel ? statusOf(channel) : undefined;

		if (!status || !embed.provider?.name?.startsWith(PROVIDER)) return embed;

		return {
			...embed,
			provider: { ...embed.provider, name: PROVIDER + SEPARATOR + label(status) },
		};
	});
}

export default decorateEmbeds;
