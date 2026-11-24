import { useComposerRow } from '@unbound-plugins/shared/composer/overlay-rows';
import { Pressable, View } from 'react-native';
import { useSyncExternalStore } from 'react';
import { messages } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';
import type { ComponentType } from 'react';

import { selectedChannelId } from '~/lib/selected-channel';
import { PREVIEW_SIZE, STICKER_SIZE } from '~/lib/constants';
import useStyles from '~/components/sticker-preview.style';
import type { Staging } from '~/lib/staging';
import type { SelectedChannels, SlowmodeChannel, StickerProps } from '~/lib/types';

type StickerPreviewProps = {
	channelId: string;
	staging: Staging;
	Sticker: ComponentType<StickerProps>;
};

const SelectedChannelStore = flux.getStore('SelectedChannel') as SelectedChannels;
const ChannelStore = flux.getStore('Channel');

function StickerPreview({ channelId, staging, Sticker }: StickerPreviewProps) {
	const styles = useStyles();
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
		<View pointerEvents='box-none' style={[styles.anchor, { top }]}>
			<Pressable
				accessibilityLabel={messages.REMOVE_STICKER_PREVIEW}
				accessibilityRole='button'
				hitSlop={8}
				onPress={() => staging.clear(channelId)}
				style={styles.frame}
			>
				<View pointerEvents='none' style={styles.sticker}>
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
