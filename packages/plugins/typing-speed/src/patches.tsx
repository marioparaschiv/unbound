import { cloneElement, isValidElement, type ReactNode } from 'react';
import { flux, metro, patcher } from '@unbound-app/api';
import { useSetting } from '@unbound-app/settings';

import { SpeedPill, type ChatInputs } from '~/components/speed-pill';

type ContainerProps = { channel?: { id?: string }; channelId?: string };

function LiveSpeedPill(props: { channelId: string; inputs: ChatInputs }) {
	return <SpeedPill {...props} live={useSetting('live')} />;
}

/**
 * @description Measures typing in the message box and shows the speed above it, by patching the render of Discord's
 * `FloatingChatInputContainer`; the draft is read from `ChatInputs`.
 */
export function patchChatInput(): void {
	const ChatInputs = metro.findByProps('getBestActiveInputForChannelId') as
		| ChatInputs
		| undefined;
	const FloatingChatInputContainer = metro.findByFilePath(
		'modules/chat_input/native/FloatingChatInputContainer.tsx',
	);

	if (!ChatInputs || !FloatingChatInputContainer) {
		logger.warn(
			'Typing speed skipped: Discord moved ChatInputs or FloatingChatInputContainer.',
		);

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
				<LiveSpeedPill key='typing-speed' channelId={channelId} inputs={ChatInputs} />
			</>,
		);
	});
}
