import { MENTION_PLACEHOLDER } from '~/constants';
import { isTextBoundary } from '@unbound-plugins/shared/native/text-attachments';

export type MentionType = 'role' | 'user';

export type Mention = {
	avatarURL?: string;
	labels: string[];
	roleColor?: number;
	type: MentionType;
};

export type MentionToken = {
	id: string;
	type: MentionType;
};

export type Role = {
	color?: number;
	icon?: string | null;
	id: string;
	name?: string;
};

export type RoleImage = Pick<Mention, 'avatarURL' | 'roleColor'>;

// Discord wraps mention labels in first-strong isolate marks (U+2068, U+2069).
function endsMention(next: string | undefined): boolean {
	return isTextBoundary(next);
}

/**
 * @description Finds the user and role mentions in raw message content, in order.
 * @param content The message's raw content, such as `Hi <@123> and <@&456>`.
 * @returns One token per mention.
 */
export function extractMentionTokens(content: string): MentionToken[] {
	return [...content.matchAll(/<@!?([0-9]+)>|<@&([0-9]+)>/g)].map((match) => ({
		id: match[1] ?? match[2],
		type: match[1] ? 'user' : 'role',
	}));
}

/**
 * @description Picks the label a rendered mention shows, preferring the longest complete match.
 * @param text Rendered text starting at or before the mention's `@`.
 * @param labels The names the mention may render as.
 * @returns The matching label, or `undefined` when none fits.
 */
export function selectMentionLabel(text: string, labels: string[]): string | undefined {
	const atOffset = text.indexOf('@');

	if (atOffset === -1) return;

	const mentionText = text.slice(atOffset);

	return [...labels]
		.sort((left, right) => right.length - left.length)
		.find((label) => {
			const prefix = `@${label}`;

			return mentionText.startsWith(prefix) && endsMention(mentionText[prefix.length]);
		});
}

/**
 * @description Checks that every mention appears as a complete `@label` somewhere in the text.
 * @param value The rendered text.
 * @param mentions The mentions to look for.
 * @returns `true` when each mention has a label rendered in full.
 */
export function containsMentionText(value: string, mentions: Mention[]): boolean {
	return mentions.every(({ labels }) =>
		labels.some((label) => {
			const prefix = `@${label}`;

			for (let index = value.indexOf(prefix); index !== -1;) {
				if (endsMention(value[index + prefix.length])) return true;

				index = value.indexOf(prefix, index + 1);
			}

			return false;
		}),
	);
}

/**
 * @description Picks the image for a role mention: its custom icon, else its color for a tinted symbol.
 * @param role The guild role.
 * @returns The role icon URL and the role color, each when present.
 */
export function roleImageSource(role: Role): RoleImage {
	return {
		avatarURL: role.icon
			? `https://cdn.discordapp.com/role-icons/${role.id}/${role.icon}.png?size=32&quality=lossless`
			: undefined,
		roleColor: typeof role.color === 'number' && role.color > 0 ? role.color : undefined,
	};
}

/**
 * @description Rewrites a Discord CDN image URL to a 32px PNG, which UIImage can decode.
 * @param url The image URL.
 * @returns The PNG URL with `size=32`.
 */
export function avatarPngURL(url: string): string {
	const png = url.replace(/\.webp(?=\?|$)/, '.png');

	if (/[?&]size=\d+/.test(png))
		return png.replace(/([?&]size=)\d+/, (_, prefix: string) => `${prefix}32`);

	return `${png}${png.includes('?') ? '&' : '?'}size=32`;
}

export default {
	extractMentionTokens,
	selectMentionLabel,
	containsMentionText,
	roleImageSource,
	avatarPngURL,
};

/**
 * @description Whether a text view's live text should be the base for the next render, rather than the original saved before the last one. Live text that is neither our own render, which carries the placeholder, nor the saved original was set by Discord, possibly for another message in a reused view, so it always wins.
 * @param live The view's current string.
 * @param savedOriginal The original string saved with the last render, if any.
 * @returns True when the next render should start from the live text.
 */
export function rebuildsFromLiveText(live: string, savedOriginal: string | undefined): boolean {
	return (
		savedOriginal === undefined ||
		(!live.includes(MENTION_PLACEHOLDER) && live !== savedOriginal)
	);
}
