import { cloneElement, isValidElement, type ReactNode } from 'react';
import { flux, metro, patcher } from '@unbound-app/api';

import { CharacterCounter } from '~/components/character-counter';

type ContainerProps = { channel?: { id?: string }; channelId?: string };

/**
 * @description Shows the counter above the composer without changing the composer's layout, by patching the render of
 * Discord's `FloatingChatInputContainer`; the counter reads the draft from `ChatInputs`.
 */
export function patchChatInput(): void {
	const ChatInputs = metro.findByProps('getBestActiveInputForChannelId');
	const FloatingChatInputContainer = metro.findByFilePath(
		'modules/chat_input/native/FloatingChatInputContainer.tsx',
	);

	if (!ChatInputs || !FloatingChatInputContainer) {
		logger.warn('Counter skipped: Discord moved ChatInputs or FloatingChatInputContainer.');

		return;
	}

	const SelectedChannelStore = flux.getStore('SelectedChannel');

	patcher.react.after(FloatingChatInputContainer, 'default', ({ props, result }) => {
		const container: ContainerProps = props;
		const channelId =
			container.channel?.id ?? container.channelId ?? SelectedChannelStore.getChannelId();

		if (!channelId || !isValidElement<{ children?: ReactNode }>(result)) return;

		return cloneElement(
			result,
			{},
			<>
				{result.props.children}
				<CharacterCounter
					key='character-counter'
					channelId={channelId}
					inputs={ChatInputs}
				/>
			</>,
		);
	});
}
