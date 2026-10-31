import { getContrastingTextColor } from '@unbound-plugins/shared/colors/role-colors';
import { patcher } from '@unbound-app/api';
import { processColor } from 'react-native';

import { ChannelStore, GuildMemberStore, GuildStore, settings, TagProperties } from '~/modules';
import { combineTagText, withTag, type TagColors } from '~/tag-properties';
import { resolveTag, type Guild, type Message } from '~/tags';
import type { LabelAppearances } from '~/label-appearances';
import { resolveTagColors } from '~/tag-colors';
import { noteTag, tagProblem } from '~/tag-problems';
import { toRendererColor } from '~/platform';

function toTagColors(colors: string[]): TagColors | undefined {
	if (!colors.length) return;

	return {
		background: toRendererColor(processColor(colors[0])),
		text: toRendererColor(processColor(getContrastingTextColor(colors))),
	};
}

/**
 * @description Adds the plugin's tag to every message header Discord builds tag properties for.
 * @param appearances Receives each tag's colors for the native gradient renderer.
 * @returns A function that removes the patch.
 */
export function patchGetTagProperties(appearances: LabelAppearances): () => void {
	if (typeof TagProperties.default !== 'function') {
		console.error('[More User Tags] Skipped, getTagProperties is not a function.');

		return () => {};
	}

	return patcher.after(TagProperties, 'default', ({ args, result }) => {
		const message: Message | undefined = args[0]?.message;
		const user = message?.author;

		if (!result || !message || !user) return;

		const channel = ChannelStore.getChannel(message.channel_id);
		const guild: Guild | undefined = channel?.guild_id
			? GuildStore.getGuild(channel.guild_id)
			: undefined;
		const tag = resolveTag(message, user, guild, channel);

		if (!tag) return;

		// The member store is optional: without it a tag keeps its own color.
		const member = guild
			? (GuildMemberStore.getMember?.(guild.id, user.id) ?? undefined)
			: undefined;
		const appearance = resolveTagColors(tag.color, [member, message], {
			useRoleColor: settings.get('useRoleColor', true),
			useEnhancedRoleColors: settings.get('useEnhancedRoleColors', true),
			coloredTags: settings.get('coloredTags', true),
		});
		const text = combineTagText(result.opTagText, tag.displayName);

		const colors = toTagColors(appearance.colors);

		appearances.set(text, appearance);
		noteTag(message.id ?? `${message.channel_id}:${user.id}`, tagProblem(text, colors));

		return withTag(result, text, colors, settings.get('useOpTagStyle', false));
	});
}

export default { patchGetTagProperties };
