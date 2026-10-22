import { paintRoleTextTree } from '@role-color-everywhere/role-text';
import type { MemberStore } from '@role-color-everywhere/chat-rows';
import { getRoleColorAppearance } from '@shared/role-colors';
import { metro, patcher } from '@unbound-app/api';
import type { ReactElement } from 'react';

const VOICE_NAME_PATH = 'modules/guild_sidebar/native/VoiceUserNameItem.tsx';

interface VoiceNameProps {
	guildId?: string;
	user?: { id?: string };
	member?: {
		colorString?: string | null;
		colorStrings?: {
			primaryColor: string;
			secondaryColor?: string;
			tertiaryColor?: string;
		} | null;
	};
}

export function installVoiceUserColors(members: MemberStore, enabled: () => boolean): () => void {
	const module = metro.findByFilePath(VOICE_NAME_PATH, { interop: false }) as {
		default?: (props: VoiceNameProps) => unknown;
	} | null;
	if (typeof module?.default !== 'function') return () => {};
	const names = module as { default: (props: VoiceNameProps) => unknown };

	return patcher.after(names, 'default', ({ args, result }) => {
		if (!enabled()) return;
		const { guildId, user, member } = (args[0] ?? {}) as VoiceNameProps;
		if (!guildId || !user?.id) return;
		const resolvedMember = member ?? members.getMember(guildId, user.id);
		const appearance = getRoleColorAppearance(
			resolvedMember?.colorStrings,
			resolvedMember?.colorString,
		);
		if (!appearance.colors.length) return;
		const children = (result as any)?.props?.children;
		if (!Array.isArray(children)) return;
		const nameElement = children[0];
		const nameChildren = nameElement?.props?.children;
		const name = Array.isArray(nameChildren) ? nameChildren[0] : nameChildren;
		if (typeof name !== 'string') return;
		const { React, ReactNative } = metro.common;
		const text = React.createElement(ReactNative.Text, null, name);
		const colored = paintRoleTextTree(text, new Map([[name, appearance]]), {
			React,
			Text: ReactNative.Text,
		});
		const styledName = React.cloneElement(nameElement, {
			children: Array.isArray(nameChildren) ? [colored, ...nameChildren.slice(1)] : colored,
		});
		return React.cloneElement(result as ReactElement<any>, {
			children: [styledName, ...children.slice(1)],
		});
	});
}
