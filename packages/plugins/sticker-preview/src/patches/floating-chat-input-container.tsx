import type { RenderTarget } from '@unbound-plugins/shared/react/render-target';
import { cloneElement, type ComponentType, type ReactElement, type ReactNode } from 'react';

import StickerPreview from '~/components/sticker-preview';
import { selectedChannelId } from '~/selected-channel';
import { Patcher, type StickerProps } from '~/modules';
import type { Staging } from '~/staging';

type ContainerProps = { channel?: { id?: string } };
type Container = ReactElement<{ children?: ReactNode }>;

/**
 * @description Shows the staged sticker above the composer.
 * @param target The render function of `FloatingChatInputContainer`.
 * @param staging The plugin's staged stickers.
 * @param Sticker Discord's sticker component, used to draw the preview.
 * @returns A function that removes the patch.
 */
export function patchFloatingChatInputContainer(
	target: RenderTarget,
	staging: Staging,
	Sticker: ComponentType<StickerProps>,
): () => void {
	return Patcher.after(target.holder, target.key, ({ args, result }) => {
		const props = args[0] as ContainerProps | undefined;
		const container: Container | null = result;
		const channelId = props?.channel?.id ?? selectedChannelId();

		if (!channelId || !container?.props) return container;

		return cloneElement(
			container,
			{},
			<>
				<StickerPreview
					key='sticker-preview'
					channelId={channelId}
					staging={staging}
					Sticker={Sticker}
				/>
				{container.props.children}
			</>,
		);
	});
}
