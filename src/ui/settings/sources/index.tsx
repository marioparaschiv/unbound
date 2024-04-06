import { showInstallAlert } from '@ui/components/internal/install-modal';
import { Dispatcher, ReactNative as RN } from '@metro/common';
import { Addons } from '@ui/components/internal';
import PluginManager from '@managers/plugins';
import { Redesign } from '@metro/components';
import { Strings } from '@api/i18n';
import sources from '@managers/sources';

export default function Sources({ headerRightMargin = false }: { headerRightMargin: boolean }) {
	React.useEffect(() => {
		if (!sources.refreshed) {
			sources.refreshed = true;
			Dispatcher.dispatch({ type: 'REFRESH_SOURCES' });
		}
	}, []);

	return <RN.View>
		<RN.Text>Hello World!</RN.Text>
	</RN.View>;
};

