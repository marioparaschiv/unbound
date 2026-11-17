import { cloneElement, isValidElement, type ReactNode } from 'react';
import { flux, metro, patcher } from '@unbound-app/api';

import { AccountPill } from '~/components/account-pill';

type ContainerProps = { channel?: { id?: string }; channelId?: string };

/**
 * @description Shows the current account above the message box while you write, by patching the render of Discord's
 * `FloatingChatInputContainer`.
 */
export function patchChatInput(): void {
	const FloatingChatInputContainer = metro.findByFilePath(
		'modules/chat_input/native/FloatingChatInputContainer.tsx',
	);

	if (!FloatingChatInputContainer) {
		logger.warn('Account avatar skipped: Discord moved FloatingChatInputContainer.');

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
				<AccountPill key='composer-account-avatar' channelId={channelId} />
			</>,
		);
	});
}
