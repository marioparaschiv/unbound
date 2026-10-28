import type { Addon } from '@unbound-app/types';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { Messages } from '~/api/i18n';
import { Icons } from '~/api/assets';

import AddonOverflow from './addon-overflow';
import AddonSettings from './addon-settings';
import AddonAuthors from './addon-authors';
import useStyles from './addon-card.style';
import AddonSwitch from './addon-switch';
import AddonRadio from './addon-radio';
import AddonTitle from './addon-title';

type AddonCardProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
	/** Whether the plugin is a library other plugins build on. */
	library?: boolean;
};

/**
 * @description One addon card: the title, authors and controls on top, the description and icon below.
 * Failed addons dim and show the manager's recorded error; recovery mode disables interaction.
 */
function AddonCard({ addon, kind, library }: AddonCardProps) {
	const styles = useStyles();
	const manager = getManager(kind);
	const { name, version, authors, description } = addon.data;

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
			<View style={styles.top}>
				<View style={styles.heading}>
					<AddonTitle
						name={name}
						version={version}
						tag={library ? Messages.UNBOUND_LIBRARY : void 0}
					/>
					{authors?.length ? <AddonAuthors authors={authors} /> : null}
				</View>
				<View style={styles.actions}>
					{kind === ManagerKind.Plugins ? (
						<AddonSettings addon={addon} disabled={disabled} />
					) : null}
					<AddonOverflow addon={addon} kind={kind} />
					{trailing}
				</View>
			</View>
			<View style={styles.bottom}>
				{description ? (
					<Discord.Text
						variant='text-sm/normal'
						style={[styles.description, { color: Theme.colors.TEXT_DEFAULT }]}
					>
						{description}
					</Discord.Text>
				) : (
					<View style={styles.spacer} />
				)}
				<View style={styles.icon}>
					<TintedIcon
						source={Icons['PuzzlePieceIcon'] ?? 0}
						size={18}
						tint={Theme.colors.TEXT_STRONG}
					/>
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
