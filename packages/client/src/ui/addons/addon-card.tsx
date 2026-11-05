import { View } from 'react-native';
import { memo } from 'react';

import useDevelopmentCopy from '~/ui/hooks/use-development-copy';
import { useUnboundSettings } from '~/settings/unbound';
import AddonTitle from '~/ui/components/addon-title';
import AddonIcon from '~/ui/components/addon-icon';
import AddonTag from '~/ui/components/addon-tag';
import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';
import { messages } from '~/i18n/api';

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
 * @description One addon card: the icon, title, authors and controls on top, the description and version below.
 * Failed addons dim and show the manager's recorded error; recovery mode disables interaction.
 */
function AddonCard({ addon, kind, library }: AddonCardProps) {
	const styles = useStyles();
	const manager = Manager.for(kind);
	const { name, version, authors, description } = addon.manifest;

	const recovery = useUnboundSettings(({ key }) => key === 'recovery').get('recovery');
	const disabled = addon.failed || recovery;

	const developmentCopy = useDevelopmentCopy(kind, addon.id);
	const tag = library ? messages.UNBOUND_LIBRARY : void 0;

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
			<Discord.Stack direction='horizontal' spacing={12} align='flex-start'>
				<AddonIcon id={addon.id} kind={kind} />
				<View style={styles.heading}>
					<AddonTitle name={name} tag={tag} />
					{authors?.length ? <AddonAuthors authors={authors} /> : null}
				</View>
				<Discord.Stack
					direction='horizontal'
					spacing={8}
					align='center'
					style={styles.actions}
				>
					{kind === 'plugin' ? <AddonSettings addon={addon} disabled={disabled} /> : null}
					<AddonOverflow addon={addon} kind={kind} developmentCopy={developmentCopy} />
					{trailing}
				</Discord.Stack>
			</Discord.Stack>
			<View style={styles.bottom}>
				{description ? (
					<Discord.Text variant='text-sm/normal' style={styles.description}>
						{description}
					</Discord.Text>
				) : (
					<View style={styles.spacer} />
				)}
				<Discord.Stack direction='horizontal' spacing={6} style={styles.badges}>
					{developmentCopy ? (
						<AddonTag variant='brand'>{messages.UNBOUND_DEVELOPMENT_COPY}</AddonTag>
					) : null}
					<AddonTag>{`v${version}`}</AddonTag>
				</Discord.Stack>
			</View>
			{error ? (
				<Discord.Text variant='text-xs/medium' style={styles.error}>
					{String(error.message ?? error)}
				</Discord.Text>
			) : null}
		</Discord.Card>
	);
}

export default memo(AddonCard);
