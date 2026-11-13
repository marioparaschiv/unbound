import { metro, patcher } from '@unbound-app/api';
import {
	cloneElement,
	isValidElement,
	type ComponentType,
	type ReactElement,
	type ReactNode,
} from 'react';

import { JumpButton, type FloatingButtonProps } from '~/components/jump-button';

const JUMP_TO_PRESENT = 'components_native/chat/JumpToPresentButton.tsx';
const FLOATING_BUTTON = 'modules/chat_input/native/ChatFloatingNavButton.tsx';

type JumpToPresentProps = { channelId?: string };

type Stack = ReactElement<{ children?: ReactNode }>;

/**
 * @description Stacks a jump-to-top arrow above Discord's jump-to-present button, so it shows only while it does.
 */
export function patchJumpToPresent(): void {
	const JumpToPresent = metro.findByFilePath(JUMP_TO_PRESENT);
	const FloatingButton: unknown = metro.findByFilePath(FLOATING_BUTTON)?.default;

	if (typeof JumpToPresent?.default !== 'function' || typeof FloatingButton !== 'function') {
		logger.warn('Jump to top skipped: Discord moved its jump-to-present button.');

		return;
	}

	patcher.after(JumpToPresent, 'default', ({ args: [props], result }) => {
		const channelId = (props as JumpToPresentProps | undefined)?.channelId;

		if (!channelId || !isValidElement(result)) return result;

		const stack = result as Stack;

		return cloneElement(
			stack,
			{},
			<JumpButton
				key='unbound-jump-to-top'
				channelId={channelId}
				FloatingButton={FloatingButton as ComponentType<FloatingButtonProps>}
			/>,
			stack.props.children,
		);
	});
}
