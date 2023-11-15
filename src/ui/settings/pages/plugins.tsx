import { i18n, React, ReactNative as RN } from '@metro/common';
import { Addons } from '@ui/settings/components';
import { Navigation } from '@metro/components';
import { showInstallAlert } from '@ui/settings/components/install-modal';
import Plugins from '@managers/plugins';

export default () => {
	const navigation = Navigation.useNavigation();
	const addons = Plugins.useEntities();

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();

		navigation.setOptions({
			title: addons.length ? `${i18n.Messages.UNBOUND_PLUGINS} - ${addons.length}` : i18n.Messages.UNBOUND_PLUGINS,
		});
	});

	return <RN.View style={{ flex: 1 }}>
		<Addons
			type='plugins'
			addons={addons}
			onPressInstall={({ type, ref }) => showInstallAlert({ type, ref })}
		/>
	</RN.View>;
};

