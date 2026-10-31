import { View } from 'react-native';
import { memo } from 'react';

import useDevelopmentCopy from '~/ui/hooks/use-development-copy';
import { useUnboundSettings } from '~/settings/unbound';
import TintedIcon from '~/metro/fallbacks/tinted-icon';
import AddonTitle from '~/ui/components/addon-title';
import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';
import { Theme } from '~/metro/common';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import AddonOverflow from './addon-overflow';
import AddonSettings from './addon-settings';
import AddonAuthors from './addon-authors';
import useStyles from './addon-card.style';
import AddonSwitch from './addon-switch';
import AddonRadio from './addon-radio';

type AddonCardProps = {
	addon: Addon;
	kind: 'plugin' | 'theme' | 'icon-pack';
	/** Whether the plugin is a library other plugins build on. */
	library?: boolean;
};

/**
 * @description One addon card: the title, authors and controls on top, the description and icon below.
 * Failed addons dim and show the manager's recorded error; recovery mode disables interaction.
 */
function AddonCard({ addon, kind, library }: AddonCardProps) {
	const styles = useStyles();
	const manager = Manager.for(kind);
	const { name, version, authors, description } = addon.manifest;

	const recovery = useUnboundSettings(({ key }) => key === 'recovery').get('recovery');
	const disabled = addon.failed || recovery;

	const developmentCopy = useDevelopmentCopy(kind, addon.id);
	const tag = library
		? messages.UNBOUND_LIBRARY
		: developmentCopy
			? messages.UNBOUND_DEVELOPMENT_COPY
			: void 0;

	const trailing =
		kind === 'plugin' ? (
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
					<AddonTitle name={name} version={version} tag={tag} />
					{authors?.length ? <AddonAuthors authors={authors} /> : null}
				</View>
				<View style={styles.actions}>
					{kind === 'plugin' ? <AddonSettings addon={addon} disabled={disabled} /> : null}
					<AddonOverflow addon={addon} kind={kind} developmentCopy={developmentCopy} />
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
						source={icons['PuzzlePieceIcon'] ?? 0}
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
