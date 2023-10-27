import { Navigation, Redesign } from '@metro/components';
import { Theme, i18n, ReactNative as RN } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';
import { InstallModal } from '@ui/settings/components';
import { TabsUIState } from '@ui/components/form';
import { getIDByName } from '@api/assets';
import { useSettingsStore } from '@api/storage';

import Themes from './themes';
import Icons from './icons';
import Fonts from './fonts';

const { colors, meta: { resolveSemanticColor } } = Theme;

const items = [
	{
		get label() {
			return i18n.Messages.UNBOUND_THEMES;
		},

		id: 'themes',
		...Themes
	},
	{
		get label() {
			return i18n.Messages.UNBOUND_ICONS;
		},

		id: 'icons',
		...Icons
	},
	{
		get label() {
			return i18n.Messages.UNBOUND_FONTS;
		},

		id: 'fonts',
		...Fonts
	}
];

function HeaderRight({ settings }: { settings: ReturnType<typeof useSettingsStore> }) {
	const ref = React.useRef<InstanceType<typeof InstallModal.InstallInput>>();
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.TouchableOpacity
		style={tabsEnabled ? {} : { marginRight: 16 }}
		onPress={() => {
			const index = settings.get('pageIndex', 0);
			const item = items[index];

			item.callback({ ref })
		}}
	>
		<RN.Image
			source={getIDByName('ic_add_circle')}
			style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) }}
		/>
	</RN.TouchableOpacity>;
}

export default () => {
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('design');
	const state = Redesign.useSegmentedControlState({
		defaultIndex: 0,
		items,
		pageWidth: ReactNative.Dimensions.get('window').width,
		onPageChange(index: number) {
			settings.set('pageIndex', index);
		}
	});

	React.useLayoutEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			unsubscribe();

			navigation.setOptions({
				headerRight: () => (
					<HeaderRight settings={settings} />
				)
			})
		})
	}, [])

	return <ReactNative.View
		style={{
			flex: 1,
			flexGrow: 1,
			justifyContent: 'space-between',
		}}
	>
		<Redesign.SegmentedControlPages state={state} />
		<ReactNative.View
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				bottom: 0,
				height: 50,
				marginBottom: 16,
				marginHorizontal: 16
			}}
		>
			<Redesign.SegmentedControl state={state} />
		</ReactNative.View>
	</ReactNative.View>;
};
