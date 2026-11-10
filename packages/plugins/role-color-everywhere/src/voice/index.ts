import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';
import { cloneElement } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore, VoiceUserNameItem } from '~/voice/modules';
import { paintRoleText } from '~/shared/role-text';
import type { Member, Rendered } from '~/types';

type VoiceUserNameItemProps = {
	guildId?: string;
	user?: { id?: string };
	member?: Member | null;
};

function patchVoiceUserNameItem(): () => void {
	return patcher.react.after(VoiceUserNameItem, 'default', ({ props, result }) => {
		const { guildId, user, member } = (props ?? {}) as VoiceUserNameItemProps;

		if (!guildId || !user?.id) return;

		const resolved = member ?? GuildMemberStore.getMember(guildId, user.id);
		const appearance = getRoleColorAppearance(resolved?.colorStrings, resolved?.colorString);
		const rendered: Rendered = result;
		const children = rendered?.props?.children;

		if (!appearance.colors.length || !Array.isArray(children)) return;

		const [nameElement, ...rest] = children;
		const nameChildren = nameElement?.props?.children;
		const name = Array.isArray(nameChildren) ? nameChildren[0] : nameChildren;

		if (typeof name !== 'string') return;

		const colored = paintRoleText(name, appearance, Text);
		const styledName = cloneElement(nameElement, {
			children: Array.isArray(nameChildren) ? [colored, ...nameChildren.slice(1)] : colored,
		});

		return cloneElement(rendered, { children: [styledName, ...rest] });
	});
}

/**
 * @description Paints members' names in voice channel user lists with their role colors while `voiceUsers` is on.
 * Patches the render of `VoiceUserNameItem` (`modules/guild_sidebar/native/VoiceUserNameItem.tsx`) and reads `GuildMemberStore`.
 * The patch returns finished elements with no closures, so removing it plains every row.
 * @returns The function that ends the feature.
 */
export function startVoice(): () => void {
	if (!ensureModules({ GuildMemberStore }, 'voice users')) return () => {};

	return whileEnabled('voiceUsers', patchVoiceUserNameItem);
}
