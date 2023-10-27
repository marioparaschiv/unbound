import { ReactNative as RN } from '@metro/common';
import { noop } from '@utilities';

function FontsPage() {
	const fonts = window.UNBOUND_FONTS ?? [];

	return <RN.View style={{ flex: 1 }}>
		{fonts.map((font) => <RN.View style={{}}>
			{font.name}
		</RN.View>)}
	</RN.View>;
}

export const callback = noop;
export default { page: <FontsPage />, callback };