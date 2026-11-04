import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement, isValidElement, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { patcher } from '@unbound-app/api';

import { withTypingAvatars } from '~/typing-avatars/components/typing-avatars';
import { Avatars, TypingIndicator, UserStore } from '~/typing-avatars/modules';

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

function addAvatars(result: ReactNode) {
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
			withTypingAvatars(renderItem(...args), userIds, item.channel?.guild_id),
	});
}

/**
 * @description Shows the typing users' avatars in the chat's typing indicator.
 * Patches the render of `TypingIndicator`, and reads avatars from `Avatars` and users from `UserStore`.
 * The Addon scope removes the patch when the plugin stops.
 */
export function startTypingAvatars(): void {
	if (!ensureModules('Typing Avatars', { Avatars, TypingIndicator, UserStore })) return;

	patcher.react.after(TypingIndicator, 'default', ({ result }) => addAvatars(result));

	recordApplied(1);
}
