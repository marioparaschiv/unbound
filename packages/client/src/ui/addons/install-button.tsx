import { View } from 'react-native';

import type { ManagerKind } from '~/lib/constants';
import { Discord } from '~/api/metro/components';
import { Screens } from '~/lib/constants';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

import InstallUrlModal from './install-url-modal';
import useStyles from './install-button.style';

type InstallButtonProps = {
	kind: ManagerKind;
};

/**
 * @description A floating action button that offers to install one addon kind by URL or to browse the
 * marketplace on that kind's tab. It always takes an explicit `kind`; the Design page computes it from
 * the active tab.
 */
function InstallButton({ kind }: InstallButtonProps) {
	const navigation = Discord.useNavigation();
	const styles = useStyles();

	// An action sheet rather than a context menu: the FAB positions itself, so it has no layout box
	// for a menu to anchor to.
	function open() {
		Discord.showSimpleActionSheet({
			key: 'unbound-install',
			header: { title: format('UNBOUND_INSTALL') },
			options: [
				{
					label: format('UNBOUND_INSTALL_FROM_URL'),
					icon: Icons['LinkIcon'],
					onPress: () =>
						Discord.openAlert(
							'unbound-install',
							<InstallUrlModal
								kind={kind}
								onClose={() => Discord.dismissAlert('unbound-install')}
							/>,
						),
				},
				{
					label: format('UNBOUND_BROWSE_MARKETPLACE'),
					icon: Icons['ShopIcon'],
					onPress: () => navigation.push(Screens.Marketplace, { kind }),
				},
			],
		});
	}

	return (
		<View style={styles.container} pointerEvents='box-none'>
			<Discord.FloatingActionButton icon={Icons['PlusLargeIcon'] ?? 0} onPress={open} />
		</View>
	);
}

export default InstallButton;
