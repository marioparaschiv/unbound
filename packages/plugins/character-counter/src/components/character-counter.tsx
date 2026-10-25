import { COMPOSER_ROW_RIGHT, useComposerRow } from '@unbound-plugins/shared/composer/overlay-rows';
import { Text, View } from 'react-native';

import useMessageCount from '~/components/use-message-count';
import { counterSurface, toneColor } from '~/colors';
import { counterTone } from '~/counter';
import { COUNTER_HEIGHT } from '~/constants';
import { ChannelStore, settings, Theme } from '~/modules';

type CharacterCounterProps = { channelId: string };

function CharacterCounter({ channelId }: CharacterCounterProps) {
	const { length, limit } = useMessageCount(channelId);
	const store = settings.useSettingsStore();
	const channel = ChannelStore.getChannel?.(channelId);
	const top = useComposerRow({
		channel,
		channelId,
		id: 'character-counter',
		order: 0,
		height: COUNTER_HEIGHT,
		shown: length > 0,
	});

	if (!length) return null;

	const colors = Theme.colors ?? {};
	const tone = counterTone(length, limit, store.get('colorEffects', true));

	return (
		<View
			pointerEvents='none'
			style={{
				position: 'absolute',
				top,
				right: COMPOSER_ROW_RIGHT,
				zIndex: 10,
			}}
		>
			<View
				style={{
					alignItems: 'center',
					backgroundColor: counterSurface(colors.TEXT_DEFAULT ?? colors.TEXT_NORMAL),
					borderRadius: 999,
					height: COUNTER_HEIGHT,
					justifyContent: 'center',
					paddingHorizontal: 7,
				}}
			>
				<Text
					accessibilityLabel={`${length} of ${limit} characters`}
					style={{
						color: toneColor(tone, colors),
						fontSize: 11,
						fontVariant: ['tabular-nums'],
						fontWeight: '600',
						lineHeight: 14,
						textAlign: 'center',
					}}
				>
					{length}/{limit}
				</Text>
			</View>
		</View>
	);
}

export default CharacterCounter;
