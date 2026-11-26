import { Pressable, View } from 'react-native';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';
import { format } from '~/i18n/api';

import type { PendingItem } from './pending-items';

import useStyles from './pending-summary.style';

/** How many updates the summary names; the rest collapse into one line, so many updates still mount few views. */
const SHOWN = 5;

type PendingSummaryProps = {
	items: PendingItem[];
};

/**
 * @description The hero's list of the first pending updates: each one's icon, name and version jump, then how
 * many more wait. Pressing one opens its changelog.
 */
function PendingSummary({ items }: PendingSummaryProps) {
	const styles = useStyles();
	const navigation = Discord.useNavigation();
	const more = items.length - SHOWN;

	return (
		<View style={styles.list}>
			{items.slice(0, SHOWN).map((item, index) => (
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
						variant='body-sm/semibold'
						color='mobile-text-heading-primary'
						lineClamp={1}
						style={styles.name}
					>
						{item.name}
					</Discord.Text>
					<Discord.Text variant='body-xs/medium' color='text-muted'>
						{`v${item.from} → `}
						<Discord.Text variant='body-xs/semibold' style={styles.version}>
							{`v${item.to}`}
						</Discord.Text>
					</Discord.Text>
					<TintedIcon source={icons.ChevronSmallRightIcon ?? 0} size={16} />
				</Pressable>
			))}
			{more > 0 ? (
				<Discord.Text
					variant='body-xs/medium'
					color='text-muted'
					style={[styles.item, styles.separated]}
				>
					{format('UNBOUND_UPDATES_MORE', { count: more })}
				</Discord.Text>
			) : null}
		</View>
	);
}

export default PendingSummary;
