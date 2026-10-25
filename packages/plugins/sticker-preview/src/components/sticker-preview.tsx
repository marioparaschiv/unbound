import { Pressable, View } from 'react-native';
import { useSyncExternalStore, type ComponentType } from 'react';

import { PREVIEW_SIZE, STICKER_SIZE } from '~/constants';
import type { StickerProps } from '~/modules';
import { selectedChannelId } from '~/selected-channel';
import type { Staging } from '~/staging';

type StickerPreviewProps = {
	channelId: string;
	staging: Staging;
	Sticker: ComponentType<StickerProps>;
};

function StickerPreview({ channelId, staging, Sticker }: StickerPreviewProps) {
	const sticker = useSyncExternalStore(
		(onChange) => staging.subscribe(channelId, onChange),
		() => staging.get(channelId)[0],
	);
	const selectedId = selectedChannelId();

	if (!sticker || (selectedId && selectedId !== channelId)) return null;

	return (
		<View
			pointerEvents='box-none'
			style={{
				alignItems: 'flex-end',
				alignSelf: 'stretch',
				height: PREVIEW_SIZE,
				justifyContent: 'center',
				marginBottom: 8,
				paddingRight: 16,
			}}
		>
			<Pressable
				accessibilityLabel='Remove sticker preview'
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
