import { ReactNative as RN } from '@metro/common';
import { TintedIcon } from '@ui/components/misc';
import { Icons } from '@api/assets';
import { noop } from '@utilities';

function FontsPage() {
	const fonts = window.UNBOUND_FONTS ?? [];

	return <RN.View style={{ flex: 1 }}>
		{fonts.map((font) => <RN.View key={font.name}>
			{font.name}
		</RN.View>)}
	</RN.View>;
}

export const callback = noop;
export default {
	renderPage: () => <FontsPage />,
	callback,
	renderIcon: () => <TintedIcon source={Icons['ic_add_text']} />
};