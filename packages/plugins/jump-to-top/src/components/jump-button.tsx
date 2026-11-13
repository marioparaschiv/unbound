import { assets } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import useStyles from '~/components/jump-button.style';
import { jumpToTop } from '~/lib/jump';

export type FloatingButtonProps = {
	icon: number | undefined;
	accessibilityLabel: string;
	onPress(): void;
};

type JumpButtonProps = { channelId: string; FloatingButton: ComponentType<FloatingButtonProps> };

/**
 * @description Discord's floating chat button with an up arrow, stacked above jump-to-present.
 * @param props The channel to scroll and Discord's floating button component.
 * @returns The stacked button.
 */
export function JumpButton({ channelId, FloatingButton }: JumpButtonProps) {
	const styles = useStyles();

	return (
		<View style={styles.stacked}>
			<FloatingButton
				icon={assets.getIdByName('ArrowLargeUpIcon')}
				accessibilityLabel={messages.JUMP_TO_TOP}
				onPress={() => void jumpToTop(channelId)}
			/>
		</View>
	);
}
