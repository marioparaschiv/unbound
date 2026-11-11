import { COMPOSER_ROW_RIGHT, useComposerRow } from '@unbound-plugins/shared/composer/overlay-rows';
import { useSetting } from '@unbound-app/settings';
import { flux, metro } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';
import { Text, View } from 'react-native';

import { characterLimit, counterTone } from '~/lib/limit';
import { counterSurface, toneColor } from '~/lib/colors';
import { useDraftLength, type ChatInputs } from '~/components/use-draft-length';
import { COUNTER_HEIGHT } from '~/lib/constants';

type CharacterCounterProps = { channelId: string; inputs: ChatInputs };

const ChannelStore = flux.getStore('Channel');
const UserStore = flux.getStore('User');

/**
 * @description The `length/limit` pill above a channel's composer, shown while a message is being written.
 * @param props The channel whose draft it counts, and Discord's composer inputs that hold the draft.
 */
export function CharacterCounter({ channelId, inputs }: CharacterCounterProps) {
	const length = useDraftLength(inputs, channelId);
	const limit = flux.useStore(UserStore, (store) => characterLimit(store.getCurrentUser()));
	const colorEffects = useSetting('colorEffects');
	const top = useComposerRow({
		channel: ChannelStore.getChannel(channelId),
		channelId,
		id: 'character-counter',
		order: 0,
		height: COUNTER_HEIGHT,
		shown: length > 0,
	});

	if (!length) return null;

	const colors = metro.common.Theme.colors ?? {};
	const tone = counterTone(length, limit, colorEffects);

	return (
		<View
			pointerEvents='none'
			style={{ position: 'absolute', top, right: COMPOSER_ROW_RIGHT, zIndex: 10 }}
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
					accessibilityLabel={format('COUNTER_LABEL', { length, limit })}
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
