import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement } from 'react';
import { Text } from 'react-native';

import { GuildMemberStore, Patcher, VoiceUserNameItem } from '~/modules';
import { PLUGIN_NAME } from '~/constants';
import { paintRoleText } from '~/role-text';

/**
 * @description Paints members' names in voice channel user lists with their role colors.
 * @returns A function that removes the patch.
 */
export function patchVoiceUserNameItem(): () => void {
	const feature = `${PLUGIN_NAME}: voice users`;

	if (!ensureModules(feature, { VoiceUserNameItem })) return () => {};

	if (typeof VoiceUserNameItem.default !== 'function') {
		console.error(`[${feature}] Skipped, VoiceUserNameItem is not a function.`);

		return () => {};
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

export default patchVoiceUserNameItem;
