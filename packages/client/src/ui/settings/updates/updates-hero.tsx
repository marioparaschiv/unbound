import { View } from 'react-native';

import type { UpdatesState } from '~/updates/state';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import UpdatesStore from '~/updates/state';

import type { PendingItem } from './pending-items';

import { describeHero } from './describe-hero';
import PendingSummary from './pending-summary';
import useStyles from './updates-hero.style';
import HeroBadge from './hero-badge';

type UpdatesHeroProps = {
	state: UpdatesState;
	/** The updates waiting, listed under the status. */
	pending: PendingItem[];
	/** How many updates Update all applies; the button hides at 0. */
	automatic: number;
	/** Whether client updates run but the newest client needs a newer loader. */
	blocked: boolean;
};

/**
 * @description The status header at the top of the updates page: a coloured badge for where things stand,
 * when it was checked, what is waiting, and the actions that check again and update everything.
 */
function UpdatesHero({ state, pending, automatic, blocked }: UpdatesHeroProps) {
	const styles = useStyles();
	const { check, applyAll } = UpdatesStore.getState();
	const hero = describeHero(state, pending.length, blocked);
	const checking = state.status === 'checking';

	return (
		<View style={styles.hero}>
			<HeroBadge tone={hero.tone} icon={hero.icon} spinning={checking} />
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
			{pending.length ? <PendingSummary items={pending} /> : null}
			<View style={styles.actions}>
				<View style={styles.action}>
					<Discord.Button
						text={messages.UNBOUND_UPDATES_CHECK}
						variant='secondary'
						size='md'
						loading={checking}
						onPress={() => void check()}
					/>
				</View>
				{automatic > 0 ? (
					<View style={styles.action}>
						<Discord.Button
							text={format('UNBOUND_UPDATES_ALL', { count: automatic })}
							variant='primary'
							size='md'
							onPress={() => void applyAll()}
						/>
					</View>
				) : null}
			</View>
		</View>
	);
}

export default UpdatesHero;
