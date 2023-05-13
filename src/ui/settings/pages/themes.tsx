import { i18n, React, ReactNative as RN } from '@metro/common';
import Themes from '@managers/themes';
import { Screens } from '@constants';
import { Icons } from '@api/assets';
import { Dialog } from '@metro/ui';

import InstallModal from '../components/installmodal';
import { Navigation } from '@metro/components';
import Addons from '../components/addons';

export default () => {
	const navigation = Navigation.useNavigation();
	const addons = Themes.useEntities();


	React.useEffect(() => {
		navigation.setOptions({ headerRight: () => <Add /> });
	}, []);

	return <RN.View style={{ flex: 1 }}>
		<Addons
			shouldRestart={true}
			type='themes'
			addons={addons}
		/>
	</RN.View>;
};

function Add() {
	const navigation = Navigation.useNavigation();
	const ref = React.useRef<InstanceType<typeof InstallModal>>();
	const url = React.useCallback(() => ref.current?.getInput(), [ref.current]);

	return <RN.TouchableOpacity style={{ marginRight: 20 }} onPress={() => {
		Dialog.confirm({
			title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'theme' }),
			confirmText: i18n.Messages.UNBOUND_THEME_GET_OPTION_CREATE,
			cancelText: i18n.Messages.UNBOUND_THEME_GET_OPTION_IMPORT,

			body: i18n.Messages.UNBOUND_THEME_GET_DESC,

			// On theme create
			onConfirm: () => {
				navigation.push(Screens.Custom, {
					title: i18n.Messages.UNBOUND_THEME_EDITOR,
					render: () => <RN.Text>hi</RN.Text>
				});
			},

			// On theme import
			onCancel: () => {
				Dialog.confirm({
					title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'theme' }),
					children: <InstallModal manager={Themes} ref={ref} />,
					confirmText: i18n.Messages.UNBOUND_INSTALL,
					onConfirm: () => url() && Themes.install(url())
				});
			}
		});
	}}>
		<RN.Image source={Icons['ic_add_circle']} />
	</RN.TouchableOpacity>;
}