import { Pressable, View } from 'react-native';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import type { PendingItem } from './pending-items';

import useStyles from './pending-summary.style';

type PendingSummaryProps = {
	items: PendingItem[];
};

/**
 * @description The hero's list of every pending update: its icon, name and version jump. Pressing one opens
 * its changelog.
 */
function PendingSummary({ items }: PendingSummaryProps) {
	const styles = useStyles();
	const navigation = Discord.useNavigation();

	return (
		<View style={styles.list}>
			{items.map((item, index) => (
				<Pressable
					key={item.key}
					accessibilityRole='button'
					onPress={() => item.open(navigation)}
					style={({ pressed }) => [
						styles.item,
						index > 0 ? styles.separated : null,
						pressed ? styles.pressed : null,
					]}
				>
					<TintedIcon source={item.icon ?? 0} size={18} />
					<Discord.Text
						variant='text-sm/semibold'
						color='mobile-text-heading-primary'
						lineClamp={1}
						style={styles.name}
					>
						{item.name}
					</Discord.Text>
					<Discord.Text variant='text-xs/medium' color='text-muted'>
						{`v${item.from} → `}
						<Discord.Text variant='text-xs/semibold' style={styles.version}>
							{`v${item.to}`}
						</Discord.Text>
					</Discord.Text>
					<TintedIcon source={icons.ChevronSmallRightIcon ?? 0} size={16} />
				</Pressable>
			))}
		</View>
	);
}

export default PendingSummary;
