import { cloneElement, isValidElement, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { metro, patcher } from '@unbound-app/api';

import { withTypingAvatars, type AvatarsModule } from '~/components/typing-avatars';

type TypingItem = {
	channel?: { guild_id?: string };
	typingUserIds?: string[];
	wrapperStyle?: unknown;
};

type TypingIndicatorProps = TypingItem & {
	item?: TypingItem;
	renderItem?: (...args: unknown[]) => ReactNode;
};

// The avatars take the place of the indicator's left padding.
function collapseGutter(item: TypingItem) {
	if (!Array.isArray(item.wrapperStyle)) return;

	item.wrapperStyle = item.wrapperStyle.map((style: ViewStyle | undefined) =>
		style?.paddingLeft != null ? { ...style, paddingLeft: 0 } : style,
	);
}

function addAvatars(result: ReactNode, avatars: AvatarsModule) {
	if (!isValidElement<TypingIndicatorProps>(result)) return result;

	const { props } = result;
	const { renderItem } = props;
	const userIds =
		props.item?.typingUserIds ??
		(Array.isArray(props.typingUserIds) ? props.typingUserIds : undefined);

	if (typeof renderItem !== 'function' || !userIds?.length) return result;

	const item = props.item ?? { channel: props.channel, wrapperStyle: props.wrapperStyle };

	collapseGutter(item);

	return cloneElement(result, {
		renderItem: (...args: unknown[]) =>
			withTypingAvatars(avatars, renderItem(...args), userIds, item.channel?.guild_id),
	});
}

/**
 * @description Shows the typing users' avatars in the chat's typing indicator.
 * Patches the render of `TypingIndicator`, and reads avatars from `Avatars` and users from `UserStore`.
 */
export function patchTypingIndicator(): void {
	const Avatars = metro.findByProps('SummarizedIconRow', 'Avatar', 'AvatarSizes');
	const TypingIndicator = metro.findByFilePath('modules/chat/native/TypingIndicator.tsx');

	if (!Avatars || !TypingIndicator) {
		logger.warn('Typing avatars skipped: Discord moved Avatars or TypingIndicator.');

		return;
	}

	patcher.react.after(TypingIndicator, 'default', ({ result }) => addAvatars(result, Avatars));
}
