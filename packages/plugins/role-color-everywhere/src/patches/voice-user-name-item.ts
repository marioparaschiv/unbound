import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { DiscordFunction } from '@unbound-app/api/metro';
import { cloneElement } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore, Patcher, VOICE_USER_NAME_ITEM_PATH } from '~/modules';
import { PLUGIN_NAME } from '~/constants';
import { paintRoleText } from '~/role-text';

type VoiceUserNameItemModule = {
	default: DiscordFunction;
};

function patchLoadedVoiceUserNameItem(VoiceUserNameItem: VoiceUserNameItemModule) {
	if (typeof VoiceUserNameItem.default !== 'function') {
		console.error(
			`[${PLUGIN_NAME}: voice users] Skipped, VoiceUserNameItem is not a function.`,
		);

		return;
	}

	return Patcher.after(VoiceUserNameItem, 'default', ({ args: [props], result }) => {
		const { guildId, user, member } = props ?? {};

		if (!guildId || !user?.id) return;

		const resolved = member ?? GuildMemberStore.getMember(guildId, user.id);
		const appearance = getRoleColorAppearance(resolved?.colorStrings, resolved?.colorString);
		const children = result?.props?.children;

		if (!appearance.colors.length || !Array.isArray(children)) return;

		const [nameElement, ...rest] = children;
		const nameChildren = nameElement?.props?.children;
		const name = Array.isArray(nameChildren) ? nameChildren[0] : nameChildren;

		if (typeof name !== 'string') return;

		const colored = paintRoleText(name, appearance, Text);
		const styledName = cloneElement(nameElement, {
			children: Array.isArray(nameChildren) ? [colored, ...nameChildren.slice(1)] : colored,
		});

		return cloneElement(result, { children: [styledName, ...rest] });
	});
}

/**
 * @description Paints members' names in voice channel user lists with their role colors, once the list item's module loads.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchVoiceUserNameItem(): () => void {
	return whenLoaded(VOICE_USER_NAME_ITEM_PATH, patchLoadedVoiceUserNameItem);
}

export default patchVoiceUserNameItem;
