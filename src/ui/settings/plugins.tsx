import { showInstallAlert } from '@ui/components/internal/install-modal';
import { React, ReactNative as RN } from '@metro/common';
import { Addons } from '@ui/components/internal';
import { Redesign } from '@metro/components';
import PluginManager from '@managers/plugins';
import { Strings } from '@api/i18n';

export default function Plugins({ headerRightMargin = false }: { headerRightMargin: boolean }) {
	const navigation = Redesign.useNavigation();
	const addons = PluginManager.useEntities();

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();

		navigation.setOptions({
			title: addons.length ? `${Strings.UNBOUND_PLUGINS} - ${addons.length}` : Strings.UNBOUND_PLUGINS,
		});
	});

	return <RN.View>
		<Addons
			type='plugins'
			addons={addons}
			onPressInstall={({ type, ref }) => showInstallAlert({ type, ref })}
			headerRightMargin={headerRightMargin}
		/>
	</RN.View>;
};

