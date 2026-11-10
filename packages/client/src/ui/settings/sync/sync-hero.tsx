import { View } from 'react-native';

import HeroBadge from '~/ui/settings/updates/hero-badge';
import { Discord } from '~/metro/components';

import type { SyncStatus } from './describe-sync';

import { describeSync } from './describe-sync';
import useStyles from './sync-hero.style';

/** One button under the status. */
export type SyncHeroAction = {
	text: string;
	variant: 'primary' | 'secondary';
	loading?: boolean;
	onPress: () => void;
};

type SyncHeroProps = {
	status: SyncStatus;
	/** The buttons, side by side under the status. */
	actions: SyncHeroAction[];
};

/**
 * @description The status header at the top of the Sync page, laid out like the updates page's: a coloured
 * badge for where Sync stands, when it last synced, and the actions that move it on.
 */
function SyncHero({ status, actions }: SyncHeroProps) {
	const styles = useStyles();
	const hero = describeSync(status);

	return (
		<View style={styles.hero}>
			<HeroBadge tone={hero.tone} icon={hero.icon} spinning={status.syncing} />
			<View style={styles.text}>
				<Discord.Text
					variant='heading-lg/bold'
					color='mobile-text-heading-primary'
					style={styles.centered}
				>
					{hero.title}
				</Discord.Text>
				<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.centered}>
					{hero.subtitle}
				</Discord.Text>
			</View>
			{actions.length ? (
				<View style={styles.actions}>
					{actions.map((action) => (
						<View key={action.text} style={styles.action}>
							<Discord.Button size='md' {...action} />
						</View>
					))}
				</View>
			) : null}
		</View>
	);
}

export default SyncHero;
