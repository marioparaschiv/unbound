import type { Addon } from '@unbound-app/types';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { Theme } from '~/api/metro/common';

import AddonCardHeader from './addon-card-header';
import AddonOverflow from './addon-overflow';
import useStyles from './addon-card.style';
import AddonSwitch from './addon-switch';
import AddonRadio from './addon-radio';

type AddonCardProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

/**
 * @description One addon card: a header, a kind-specific trailing control, and an overflow menu. The
 * card chooses the trailing element from `kind` once and composes it, rather than branching on a mode
 * flag. Failed addons dim and show the manager's recorded error; recovery mode disables interaction.
 */
function AddonCard({ addon, kind }: AddonCardProps) {
	const styles = useStyles();
	const manager = getManager(kind);

	const recovery = useSettingsStore('unbound', ({ key }) => key === 'recovery').get(
		'recovery',
		false,
	);
	const disabled = addon.failed || recovery;

	const trailing =
		kind === ManagerKind.Plugins ? (
			<AddonSwitch addon={addon} kind={kind} disabled={disabled} />
		) : (
			<AddonRadio addon={addon} kind={kind} disabled={disabled} />
		);

	const error = addon.failed ? manager.errors.get(addon.id) : undefined;

	return (
		<Discord.Card
			variant='primary'
			border='subtle'
			shadow='low'
			style={[styles.card, disabled ? styles.failed : null]}
		>
			<View style={styles.row}>
				<View style={styles.body}>
					<AddonCardHeader addon={addon} />
				</View>
				<View style={styles.trailing}>
					{trailing}
					<AddonOverflow addon={addon} kind={kind} />
				</View>
			</View>
			{error ? (
				<Discord.Text
					variant='text-xs/medium'
					style={[styles.error, { color: Theme.colors.TEXT_FEEDBACK_CRITICAL }]}
				>
					{String(error.message ?? error)}
				</Discord.Text>
			) : null}
		</Discord.Card>
	);
}

export default memo(AddonCard);
