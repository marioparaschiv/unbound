import { View } from 'react-native';

import { answerBisect, bisectStatus, stopBisect } from '~/plugins/bisect';
import type { BisectResult } from '~/plugins/bisect-steps';
import { useUnboundSettings } from '~/settings/unbound';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { plugins } from '~/plugins/manager';
import { alert } from '~/dialogs/api';

import useStyles from './bisect-card.style';

function pluginName(id: string): string {
	return plugins.getAddon(id)?.manifest.name ?? id;
}

function announce({ culprit }: BisectResult) {
	if (culprit) {
		void alert('UNBOUND_BISECT_FOUND_TITLE', {
			body: 'UNBOUND_BISECT_FOUND',
			bodyVars: { name: pluginName(culprit) },
		});

		return;
	}

	void alert('UNBOUND_BISECT_NOT_PLUGIN_TITLE', { body: 'UNBOUND_BISECT_NOT_PLUGIN' });
}

function answer(stillHappens: boolean) {
	const next = answerBisect(stillHappens);

	if (next && 'culprit' in next) {
		announce(next);
	}
}

/**
 * @description While a plugin bisect runs, says which round it is and how many plugins are on, and asks whether the
 * problem still happens, with a button to stop. Renders nothing otherwise.
 */
function BisectCard() {
	const styles = useStyles();

	useUnboundSettings(({ key }) => key === 'plugins.bisect');

	const status = bisectStatus();

	if (!status) return null;

	return (
		<Discord.Card style={styles.card}>
			<Discord.Text variant='heading-md/bold' color='mobile-text-heading-primary'>
				{messages.UNBOUND_BISECT_TITLE}
			</Discord.Text>
			<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.body}>
				{format('UNBOUND_BISECT_ROUND', {
					round: status.round,
					left: status.roundsLeft,
					count: status.tested.length,
				})}
			</Discord.Text>
			<View style={styles.actions}>
				<View style={styles.action}>
					<Discord.Button
						text={messages.UNBOUND_BISECT_STILL_HAPPENS}
						variant='primary'
						size='md'
						onPress={() => answer(true)}
					/>
				</View>
				<View style={styles.action}>
					<Discord.Button
						text={messages.UNBOUND_BISECT_GONE}
						variant='secondary'
						size='md'
						onPress={() => answer(false)}
					/>
				</View>
			</View>
			<Discord.Button
				text={messages.UNBOUND_BISECT_STOP}
				variant='tertiary'
				size='md'
				onPress={stopBisect}
			/>
		</Discord.Card>
	);
}

export default BisectCard;
