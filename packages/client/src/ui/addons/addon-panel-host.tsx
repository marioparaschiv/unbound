import useAddonPhase, { type PhaseSource } from '~/ui/hooks/use-addon-phase';
import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Theme } from '~/metro/common';
import { messages } from '~/i18n/api';

import useStyles from './addon-panel-host.style';

type AddonPanelHostProps = {
	addon: PhaseSource & Pick<Addon, 'SettingsPanel'>;
};

/**
 * @description Renders a plugin's settings panel while the plugin runs; once it stops or fails, swaps to a notice,
 * so an open panel never keeps rendering a stopped plugin's components.
 */
function AddonPanelHost({ addon }: AddonPanelHostProps) {
	const styles = useStyles();

	useAddonPhase('plugin', addon);

	const Panel = addon.SettingsPanel;

	return Panel ? (
		<Panel />
	) : (
		<Discord.Text
			variant='text-md/medium'
			style={[styles.notice, { color: Theme.colors.TEXT_MUTED }]}
		>
			{messages.UNBOUND_PLUGIN_NOT_RUNNING}
		</Discord.Text>
	);
}

export default AddonPanelHost;
