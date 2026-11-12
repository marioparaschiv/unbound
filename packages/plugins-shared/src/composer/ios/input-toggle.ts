import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { metro, patcher } from '@unbound-app/api';

import { channelOf, type ToggleButtonFactory } from '../toggle-channel';

type ParentProps = { children?: ReactNode };

/**
 * @description Prepends the toggle to `ChatInputRightActions`, which stays on screen while typing.
 * @param button Draws the toggle for a channel.
 * @param name What log lines call the toggle.
 */
export function patchRightActions(button: ToggleButtonFactory, name: string): void {
	const RightActions = metro.findByFilePath(
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
	);

	if (!RightActions) {
		logger.warn(`${name} toggle skipped: Discord moved ChatInputRightActions.`);

		return;
	}

	patcher.react.after(RightActions, 'default', ({ props, result }) => {
		const channelId = channelOf(props);

		if (!channelId || !isValidElement<ParentProps>(result)) return;

		return cloneElement(
			result,
			undefined,
			button(channelId, 0),
			...Children.toArray(result.props.children),
		);
	});
}

export default patchRightActions;
