import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import useStyles from './error-boundary.style';

type ErrorActionProps = {
	label: string;
	/** The asset name of the action's icon. */
	icon: string;
	onPress: () => void;
};

/**
 * @description One of the crash screen's secondary actions: an icon over its label on Discord's pressable card,
 * like the Unbound page's quick actions.
 */
function ErrorAction({ label, icon, onPress }: ErrorActionProps) {
	const styles = useStyles();

	return (
		<Discord.Card accessibilityLabel={label} onPress={onPress} style={styles.tile}>
			<Discord.TableRowIcon source={icons[icon]} />
			<Discord.Text
				variant='text-sm/semibold'
				color='mobile-text-heading-primary'
				lineClamp={1}
			>
				{label}
			</Discord.Text>
		</Discord.Card>
	);
}

export default ErrorAction;
