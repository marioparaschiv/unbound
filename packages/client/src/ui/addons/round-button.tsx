import type { PressableStateCallbackType } from 'react-native';
import { Pressable } from 'react-native';
import { memo } from 'react';

import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';

import useStyles from './round-button.style';

type RoundButtonProps = {
	icon: string;
	label: string;
	disabled?: boolean;
	onPress: () => void;
};

/**
 * @description A round icon button drawn from Discord's secondary control tokens. Discord's
 * `IconButton` takes its corner radius from the theme's button token, so it can't be round.
 */
function RoundButton({ icon, label, disabled, onPress }: RoundButtonProps) {
	const styles = useStyles();

	return (
		<Pressable
			disabled={disabled}
			hitSlop={6}
			accessibilityRole='button'
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }: PressableStateCallbackType) => [
				styles.button,
				pressed ? styles.pressed : null,
				disabled ? styles.disabled : null,
			]}
		>
			<TintedIcon
				source={Icons[icon] ?? 0}
				size={16}
				tint={Theme.colors.CONTROL_SECONDARY_TEXT_DEFAULT}
			/>
		</Pressable>
	);
}

export default memo(RoundButton);
