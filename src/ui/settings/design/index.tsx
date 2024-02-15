import HeaderRight from '@ui/components/internal/addon-header';
import { Redesign } from '@metro/components';
import { InstallModal } from '@ui/components/internal';
import { ReactNative as RN } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import { Strings } from '@api/i18n';

import Themes from './themes';
import Icons from './icons';
import Fonts from './fonts';

const items = [
	{
		get label() {
			return Strings.UNBOUND_THEMES;
		},

		id: 'Themes',
		...Themes
	},
	{
		get label() {
			return Strings.UNBOUND_ICONS;
		},

		id: 'Icons',
		...Icons
	},
	{
		get label() {
			return Strings.UNBOUND_FONTS;
		},

		id: 'Fonts',
		...Fonts
	}
] as const;

export default function Design() {
	const ref = React.useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const navigation = Redesign.useNavigation();
	const settings = useSettingsStore('unbound');
	const state = Redesign.useSegmentedControlState({
		defaultIndex: settings.get('designPageIndex', 0),
		items,
		pageWidth: ReactNative.Dimensions.get('window').width,
		onPageChange(index: number) {
			settings.set('designPageIndex', index);
		}
	});

	React.useLayoutEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			unsubscribe();

			navigation.setOptions({
				headerRight: () => <HeaderRight
					type={() => items[settings.get('designPageIndex', 0)].id}
					settings={settings}
					onPress={() => {
						const index = settings.get('designPageIndex', 0);
						const item = items[index];

						item.callback({ ref, type: item.id });
					}}
				/>
			});
		});
	}, []);


	return <RN.View
		style={{
			flex: 1,
			flexGrow: 1,
			justifyContent: 'space-between'
		}}
	>
		<Redesign.SegmentedControlPages state={state} />
		<RN.SafeAreaView
			style={{
				position: 'absolute',
				bottom: 0,
				height: 'auto',
				marginBottom: 36,
				marginHorizontal: 36
			}}
		>
			<Redesign.SegmentedControl state={state} variant={'experimental_Large'} />
		</RN.SafeAreaView>
	</RN.View>;
};
