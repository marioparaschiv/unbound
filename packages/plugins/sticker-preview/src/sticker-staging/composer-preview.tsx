import { cloneElement, isValidElement, type ReactNode } from 'react';
import { patcher } from '@unbound-app/api';

import StickerPreview from '~/sticker-staging/components/sticker-preview';
import { FloatingChatInputContainer } from '~/sticker-staging/modules';
import { selectedChannelId } from '~/sticker-staging/selected-channel';
import type { Staging } from '~/sticker-staging/staging';

type ContainerProps = { channel?: { id?: string } };

/**
 * @description Shows the staged sticker above the composer.
 * @param staging The plugin's staged stickers.
 */
export function patchFloatingChatInputContainer(staging: Staging): void {
	patcher.react.after(
		FloatingChatInputContainer,
		'default',
		({ props, result }: { props: ContainerProps; result: ReactNode }) => {
			const channelId = props.channel?.id ?? selectedChannelId();

			if (!channelId || !isValidElement<{ children?: ReactNode }>(result)) return result;

			return cloneElement(
				result,
				{},
				<>
					{result.props.children}
					<StickerPreview key='sticker-preview' channelId={channelId} staging={staging} />
				</>,
			);
		},
	);
}
