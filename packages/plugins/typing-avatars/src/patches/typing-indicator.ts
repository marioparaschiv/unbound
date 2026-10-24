import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import type { ReactElement, ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { cloneElement } from 'react';

import { withTypingAvatars } from '~/components/typing-avatars';
import { Patcher } from '~/modules';

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

function addAvatars(result: ReactElement<TypingIndicatorProps> | null) {
	const props = result?.props;

	if (!props) return result;

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
 * @description Shows the typing users' avatars in the chat's typing indicator, patching it once Discord loads it.
 * @returns A function that removes the patch, or stops waiting for the module.
 */
export function patchTypingIndicator(): () => void {
	return whenLoaded('modules/chat/native/TypingIndicator.tsx', (module: AnyProps) => {
		const target = findRenderTarget(module);

		if (!target) {
			console.error(
				'[Typing Avatars] Not starting, the typing indicator has no render function.',
			);

			return () => {};
		}

		return Patcher.after(target.holder, target.key, ({ result }) => addAvatars(result));
	});
}
