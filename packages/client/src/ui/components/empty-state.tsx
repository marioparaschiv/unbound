import { View } from 'react-native';

import type { HeroTone } from '~/ui/settings/updates/describe-hero';
import HeroBadge from '~/ui/settings/updates/hero-badge';
import { Discord } from '~/metro/components';

import useStyles from './empty-state.style';

type EmptyStateProps = {
	children: string;
	/** The badge's icon asset name; a magnifying glass when omitted. */
	icon?: string;
	tone?: HeroTone;
};

/**
 * @description A centered badge and message, laid out like the updates hero and the no-addons page.
 */
function EmptyState({ children, icon = 'MagnifyingGlassIcon', tone = 'neutral' }: EmptyStateProps) {
	const styles = useStyles();

	return (
		<View style={styles.container}>
			<HeroBadge tone={tone} icon={icon} spinning={false} />
			<Discord.Text variant='text-md/medium' color='text-muted' style={styles.text}>
				{children}
			</Discord.Text>
		</View>
	);
}

export default EmptyState;
