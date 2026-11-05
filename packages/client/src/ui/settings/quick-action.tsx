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
 * @description One tile of the Unbound page's quick actions: an icon over a label, on Discord's pressable card.
 */
function QuickAction({ label, icon, onPress }: QuickActionProps) {
	const styles = useStyles();

	return (
		<Discord.Card accessibilityLabel={label} onPress={onPress} style={styles.tile}>
			<Discord.TableRowIcon source={icons[icon]} />
			<Discord.Text variant='text-sm/semibold' color='mobile-text-heading-primary'>
				{label}
			</Discord.Text>
		</Discord.Card>
	);
}

export default QuickAction;
