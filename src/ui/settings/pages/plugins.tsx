import { i18n, React, ReactNative as RN, Theme } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';
import Plugins from '@managers/plugins';
import { Icons } from '@api/assets';
import { Dialog } from '@metro/ui';

import InstallModal from '../components/installmodal';
import { Navigation } from '@metro/components';
import Addons from '../components/addons';

const { colors, meta: { resolveSemanticColor } } = Theme;

export default () => {
	const navigation = Navigation.useNavigation();
	const addons = Plugins.useEntities();

	React.useEffect(() => {
		navigation.setOptions({
			title: addons.length ? `${i18n.Messages.UNBOUND_PLUGINS} - ${addons.length}` : i18n.Messages.UNBOUND_PLUGINS,
			headerRight: () => <HeaderRight />
		});
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

	return <RN.Pressable
		hitSlop={25}
		style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1.0, marginRight: 16 })}
		onPress={() => {
			Dialog.confirm({
				title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'plugin' }),
				children: <InstallModal manager={Plugins} ref={ref} />,
				confirmText: i18n.Messages.UNBOUND_INSTALL,
				onConfirm: () => url() && Plugins.install(url())
			});
		}}
	>
		<RN.Image 
            source={Icons['ic_add_circle']}
            style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) }} 
        />
	</RN.Pressable>;
}