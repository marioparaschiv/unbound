import { getContrastingTextColor } from '@unbound-plugins/shared/colors/role-colors';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { DiscordFunction } from '@unbound-app/api/metro';
import type { PluginContext } from '@unbound-app/api/native';
import { processColor } from 'react-native';

import {
	byTagProperties,
	ChannelStore,
	GuildMemberStore,
	GuildStore,
	Patcher,
	settings,
} from '~/modules';
import { combineTagText, toRendererColor, withTag, type TagColors } from '~/tag-properties';
import { resolveTag, type Guild, type Message } from '~/tags';
import type { LabelAppearances } from '~/label-appearances';
import { resolveTagColors } from '~/tag-colors';

function toTagColors(colors: string[], platform: PluginContext['platform']): TagColors | undefined {
	if (!colors.length) return;

	return {
		background: toRendererColor(processColor(colors[0]), platform),
		text: toRendererColor(processColor(getContrastingTextColor(colors)), platform),
	};
}

type TagPropertiesModule = {
	default: DiscordFunction;
};

function patchLoadedGetTagProperties(
	TagProperties: TagPropertiesModule,
	platform: PluginContext['platform'],
	appearances: LabelAppearances,
) {
	if (typeof TagProperties.default !== 'function') {
		console.error('[More User Tags] Skipped, getTagProperties is not a function.');

		return;
	}

	return Patcher.after(TagProperties, 'default', ({ args, result }) => {
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
		const member = guild ? GuildMemberStore.getMember?.(guild.id, user.id) : undefined;
		const appearance = resolveTagColors(tag.color, [member, message], {
			useRoleColor: settings.get('useRoleColor', true),
			useEnhancedRoleColors: settings.get('useEnhancedRoleColors', true),
			coloredTags: settings.get('coloredTags', true),
		});
		const text = combineTagText(result.opTagText, tag.displayName);

		appearances.set(text, appearance);

		return withTag(
			result,
			text,
			toTagColors(appearance.colors, platform),
			settings.get('useOpTagStyle', false),
		);
	});
}

/**
 * @description Adds the plugin's tag to every message header Discord builds tag properties for, once `getTagProperties` loads.
 * @param platform The platform the plugin runs on.
 * @param appearances Receives each tag's colors for the native gradient renderer.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchGetTagProperties(
	platform: PluginContext['platform'],
	appearances: LabelAppearances,
): () => void {
	return whenLoaded<TagPropertiesModule>(
		byTagProperties,
		(TagProperties) => patchLoadedGetTagProperties(TagProperties, platform, appearances),
		{ interop: false },
	);
}

export default { patchGetTagProperties };
