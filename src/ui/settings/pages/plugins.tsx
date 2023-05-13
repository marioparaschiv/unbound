import { i18n, React, ReactNative as RN } from '@metro/common';
import Plugins from '@managers/plugins';
import { Icons } from '@api/assets';
import { Dialog } from '@metro/ui';

import InstallModal from '../components/installmodal';
import { Navigation } from '@metro/components';
import Addons from '../components/addons';

export default () => {
	const navigation = Navigation.useNavigation();
	const addons = Plugins.useEntities();

	React.useEffect(() => {
		navigation.setOptions({ headerRight: () => <HeaderRight /> });
	}, []);

	return <RN.View style={{ flex: 1 }}>
		<Addons
			type='plugins'
			addons={addons}
		/>
	</RN.View>;
};

function HeaderRight() {
	const ref = React.useRef<InstanceType<typeof InstallModal>>();
	const url = React.useCallback(() => ref.current?.getInput(), [ref.current]);

	return <RN.TouchableOpacity
		style={{ marginRight: 20 }}
		onPress={() => {
			Dialog.confirm({
				title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'plugin' }),
				children: <InstallModal manager={Plugins} ref={ref} />,
				confirmText: i18n.Messages.UNBOUND_INSTALL,
				onConfirm: () => url() && Plugins.install(url())
			});
		}}
	>
		<RN.Image source={Icons['ic_add_circle']} />
	</RN.TouchableOpacity>;
}