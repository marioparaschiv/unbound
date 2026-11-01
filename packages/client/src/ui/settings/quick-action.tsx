import type { PressableStateCallbackType } from 'react-native';
import { Pressable } from 'react-native';

import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import useStyles from './quick-actions.style';

type QuickActionProps = {
	label: string;
	/** The asset name of the action's icon. */
	icon: string;
	onPress: () => void;
};

/**
 * @description One tile of the Unbound page's quick actions: an icon over a label.
 */
function QuickAction({ label, icon, onPress }: QuickActionProps) {
	const styles = useStyles();

	return (
		<Pressable
			accessibilityRole='button'
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }: PressableStateCallbackType) => [
				styles.tile,
				pressed ? styles.pressed : null,
			]}
		>
			<Discord.TableRowIcon source={icons[icon]} />
			<Discord.Text variant='text-sm/semibold' color='mobile-text-heading-primary'>
				{label}
			</Discord.Text>
		</Pressable>
	);
}

export default QuickAction;
