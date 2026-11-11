import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement, isValidElement, type ReactNode } from 'react';
import { patcher } from '@unbound-app/api';

import { ChatInputs, FloatingChatInputContainer, SelectedChannelStore } from '~/counter/modules';
import { CharacterCounter } from '~/counter/components/character-counter';

type ContainerProps = { channel?: { id?: string }; channelId?: string };

/**
 * @description Shows the counter above the composer without changing the composer's layout.
 * Patches the render of `FloatingChatInputContainer`, reads the draft from `ChatInputs`, and the
 * Nitro tier from `UserStore`. The Addon scope removes the patch when the plugin stops.
 */
export function startCounter(): void {
	if (!ensureModules({ ChatInputs, FloatingChatInputContainer })) return;

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
				<CharacterCounter key='character-counter' channelId={channelId} />
			</>,
		);
	});
}
