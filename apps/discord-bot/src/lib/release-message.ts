import type { RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { ButtonStyle, ComponentType } from 'discord.js';

import { COLOURS } from '~/lib/constants';

/** The repository whose releases and commits the release feeds link to. */
export const REPOSITORY = 'marioparaschiv/unbound';
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;

export type ReleaseMessage = {
	/** Names the release; adoption matches posts by it, so it must be unique per release. */
	title: string;
	/** One short line under the title, beside the timestamp. */
	detail: string;
	changelogUrl: string;
	publishedAt: Date;
};

/**
 * @description Renders a compact release post: a titled embed with a footer line and timestamp, and a changelog button.
 * @param release The release's title, detail line, changelog url and publish time.
 * @returns The message body to post; it pings no one.
 */
export function renderReleaseMessage(release: ReleaseMessage): RESTPostAPIChannelMessageJSONBody {
	return {
		embeds: [
			{
				title: release.title,
				url: release.changelogUrl,
				color: COLOURS.brand,
				footer: { text: release.detail },
				timestamp: release.publishedAt.toISOString(),
			},
		],
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Link,
						label: 'View changelog',
						url: release.changelogUrl,
					},
				],
			},
		],
		allowed_mentions: { parse: [] },
	};
}

export default { REPOSITORY, REPOSITORY_URL, renderReleaseMessage };
