import { COMPOSER_ROW_RIGHT, useComposerRow } from '@unbound-plugins/shared/composer/overlay-rows';
import { Pressable, View } from 'react-native';
import { useSyncExternalStore } from 'react';
import { messages } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import { ChannelStore, SelectedChannelStore, StickerModule } from '~/sticker-staging/modules';
import { selectedChannelId } from '~/sticker-staging/selected-channel';
import { PREVIEW_SIZE, STICKER_SIZE } from '~/constants';
import type { Staging } from '~/sticker-staging/staging';
import type { SlowmodeChannel } from '~/types';

type StickerPreviewProps = {
	channelId: string;
	staging: Staging;
};

function StickerPreview({ channelId, staging }: StickerPreviewProps) {
	const sticker = useSyncExternalStore(
		(onChange) => staging.subscribe(channelId, onChange),
		() => staging.get(channelId)[0],
	);
	const selectedId = flux.useStore(SelectedChannelStore, selectedChannelId);
	const shown = Boolean(sticker) && (!selectedId || selectedId === channelId);
	const channel: SlowmodeChannel | undefined = flux.useStore(
		ChannelStore,
		(store) => store.getChannel?.(channelId),
		{ deps: [channelId] },
	);
	const Sticker = StickerModule.default;
	const top = useComposerRow({
		channel,
		channelId,
		id: 'sticker-preview',
		order: 1,
		height: PREVIEW_SIZE,
		shown,
	});

	if (!sticker || !shown) return null;

	return (
		<View
			pointerEvents='box-none'
			style={{
				position: 'absolute',
				right: COMPOSER_ROW_RIGHT,
				top,
				zIndex: 10,
			}}
		>
			<Pressable
				accessibilityLabel={messages.REMOVE_STICKER_PREVIEW}
				accessibilityRole='button'
				hitSlop={8}
				onPress={() => staging.clear(channelId)}
				style={{
					alignItems: 'center',
					backgroundColor: 'rgba(46,40,59,0.96)',
					borderColor: 'rgba(255,255,255,0.48)',
					borderWidth: 1.5,
					justifyContent: 'center',
					height: PREVIEW_SIZE,
					width: PREVIEW_SIZE,
					borderRadius: 18,
					overflow: 'hidden',
				}}
			>
				<View
					pointerEvents='none'
					style={{
						borderRadius: 16,
						height: STICKER_SIZE,
						overflow: 'hidden',
						width: STICKER_SIZE,
					}}
				>
					<Sticker
						animated
						opaque={sticker.opaque ?? true}
						size={STICKER_SIZE}
						sticker={sticker}
					/>
				</View>
			</Pressable>
		</View>
	);
}

export default StickerPreview;
