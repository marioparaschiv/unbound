import Animated from 'react-native-reanimated';
import { memo } from 'react';

import useAddonPhase from '~/ui/hooks/use-addon-phase';
import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Screens } from '~/core/constants';
import { icons } from '~/assets/api';

import useSettingsButtonMotion from './use-settings-button-motion';
import { settingsButtonState } from './settings-button-state';
import AddonPanelHost from './addon-panel-host';
import useStyles from './round-pill.style';

type AddonSettingsProps = {
	addon: Addon;
	disabled?: boolean;
};

/**
 * @description The card's settings button, live with the plugin's lifecycle: shown while it has a panel, pressable
 * only while it runs, and animated in and out from under the overflow button, which renders above it.
 */
function AddonSettings({ addon, disabled }: AddonSettingsProps) {
	const styles = useStyles();
	const navigation = Discord.useNavigation();
	const { phase, hasPanel } = useAddonPhase('plugin', addon);
	const { visible, enabled } = settingsButtonState(phase, hasPanel);
	const { mounted, style } = useSettingsButtonMotion(visible);

	function handlePress() {
		if (!addon.SettingsPanel) return;

		navigation.push(Screens.PanelHost, {
			title: addon.name,
			render: () => <AddonPanelHost addon={addon} />,
		});
	}

	return mounted ? (
		<Animated.View style={style}>
			<Discord.IconButton
				icon={icons['SettingsIcon'] ?? 0}
				variant='secondary'
				size='sm'
				pillStyle={styles.pill}
				hitSlop={6}
				accessibilityLabel={`${addon.name} settings`}
				disabled={disabled || !visible || !enabled}
				onPress={handlePress}
			/>
		</Animated.View>
	) : null;
}

export default memo(AddonSettings);
