import { Redesign } from '@metro/components';

import Themes from './themes';
import Icons from './icons';
import { i18n } from '@metro/common';

const items = [
	{
		get label() {
			return i18n.Messages.UNBOUND_THEMES;
		},

		id: 'themes',
		page: <Themes />
	},
	{
		get label() {
			return i18n.Messages.UNBOUND_ICONS;
		},

		id: 'icons',
		page: <Icons />
	}
]

export default () => {
	const state = Redesign.useSegmentedControlState({
		defaultIndex: 0,
		items,
		pageWidth: ReactNative.Dimensions.get('window').width,
	});

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
	</ReactNative.View>
}
