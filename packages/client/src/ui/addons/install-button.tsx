import { View } from 'react-native';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { Icons } from '~/api/assets';

import InstallUrlModal from './install-url-modal';
import useStyles from './install-button.style';

type InstallButtonProps = {
	kind: ManagerKind;
};

/**
 * @description A floating action button that starts an install for one addon kind. It always takes an
 * explicit `kind`; the Design page computes it from the active tab so the button never reads tab state.
 */
function InstallButton({ kind }: InstallButtonProps) {
	const styles = useStyles();

	function open() {
		Discord.openAlert(
			'unbound-install',
			<InstallUrlModal kind={kind} onClose={() => Discord.dismissAlerts()} />,
		);
	}

	return (
		<View style={styles.container} pointerEvents='box-none'>
			<Discord.FloatingActionButton icon={Icons['PlusLargeIcon'] ?? 0} onPress={open} />
		</View>
	);
}

export default InstallButton;
