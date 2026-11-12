import { getContrastingTextColor } from '@unbound-plugins/shared/colors/role-colors';
import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';
import { processColor } from 'react-native';

import { DiscordConstants, PermissionUtils } from '~/lib/modules';
import { combineTagText, withTag, type TagColors } from '~/lib/tag-properties';
import { noteTag, tagProblem } from '~/lib/tag-problems';
import { labelAppearances } from '~/lib/label-appearances';
import { resolveTag } from '~/lib/resolve-tag';
import { resolveTagColors } from '~/lib/tag-colors';
import { toRendererColor } from '~/lib/renderer-color';
import type { Guild, Message } from '~/lib/types';

const ChannelStore = flux.getStore('Channel');
const GuildStore = flux.getStore('Guild');
const GuildMemberStore = flux.getStore('GuildMember');

function toTagColors(colors: string[]): TagColors | undefined {
	if (!colors.length) return;

	return {
		background: toRendererColor(processColor(colors[0])),
		text: toRendererColor(processColor(getContrastingTextColor(colors))),
	};
}

/**
 * @description Adds the plugin's tag to every message header Discord builds tag properties for.
 * Patches the default export of `getTagProperties`, and records each tag's colors for the native gradient renderer.
 */
export function patchTagProperties(): void {
	const TagProperties = metro.findByName('getTagProperties', { interop: false });

	if (!TagProperties || !DiscordConstants || !PermissionUtils) {
		logger.warn(
			'Tags skipped: Discord moved getTagProperties, its constants or its permission utilities.',
		);

		return;
	}

	patcher.after(TagProperties, 'default', ({ args, result }) => {
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
			useRoleColor: settings.useRoleColor,
			useEnhancedRoleColors: settings.useEnhancedRoleColors,
			coloredTags: settings.coloredTags,
		});
		const text = combineTagText(result.opTagText, tag.displayName());
		const colors = toTagColors(appearance.colors);

		labelAppearances.set(text, appearance);
		noteTag(message.id ?? `${message.channel_id}:${user.id}`, tagProblem(text, colors));

		return withTag(result, text, colors, settings.useOpTagStyle);
	});
}
