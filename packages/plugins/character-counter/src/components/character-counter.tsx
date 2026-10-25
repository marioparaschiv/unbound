import { composerRowTop } from '@unbound-plugins/shared/composer/overlay-rows';
import { Text, View } from 'react-native';

import useMessageCount from '~/components/use-message-count';
import { counterSurface, toneColor } from '~/colors';
import { counterTone } from '~/counter';
import { ChannelStore, settings, Theme } from '~/modules';

type CharacterCounterProps = { channelId: string };

function CharacterCounter({ channelId }: CharacterCounterProps) {
	const { length, limit } = useMessageCount(channelId);
	const store = settings.useSettingsStore();

	if (!length) return null;

	const colors = Theme.colors ?? {};
	const tone = counterTone(length, limit, store.get('colorEffects', true));
	const channel = ChannelStore.getChannel?.(channelId);

	return (
		<View
			pointerEvents='none'
			style={{
				position: 'absolute',
				top: composerRowTop(channel),
				right: 28,
				zIndex: 10,
			}}
		>
			<View
				style={{
					alignItems: 'center',
					backgroundColor: counterSurface(colors.TEXT_DEFAULT ?? colors.TEXT_NORMAL),
					borderRadius: 999,
					height: 20,
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
