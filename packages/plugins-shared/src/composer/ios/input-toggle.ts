import { isValidElement } from 'react';
import { metro, patcher } from '@unbound-app/api';

import { channelOf, type ToggleButtonFactory } from '../toggle-channel';
import { withComposerButton, type ComposerButtonDetails } from '../composer-stack';

/**
 * @description Prepends the toggle to `ChatInputRightActions`, which stays on screen while typing; a crowded draft stacks it
 * above the emoji and send buttons instead.
 * @param button Draws the toggle for a channel.
 * @param name What log lines call the toggle.
 * @param key The button's key, which the Plugin Shortcut Panel collects buttons by.
 * @param details The button's label and the row the Plugin Shortcut Panel shows for it.
 */
export function patchRightActions(
	button: ToggleButtonFactory,
	name: string,
	key?: string,
	details?: ComposerButtonDetails,
): void {
	const RightActions = metro.findByFilePath(
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
	);

	if (!RightActions) {
		logger.warn(`${name} toggle skipped: Discord moved ChatInputRightActions.`);

		return;
	}

	patcher.react.after(RightActions, 'default', ({ props, result }) => {
		const channelId = channelOf(props);

		if (!channelId || !isValidElement(result)) return;

		return withComposerButton(result, {
			channelId,
			draw: (gap: number) => button(channelId, gap),
			key,
			details,
			inline: 'prepend',
			rowGap: 0,
		});
	});
}

export default patchRightActions;
