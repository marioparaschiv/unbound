import { ReactNative as RN } from '@metro/common';

function Fonts() {
	const fonts = window.UNBOUND_FONTS ?? [];

	return <RN.View style={{ flex: 1 }}>
		{fonts.map((font) => <RN.View style={{}}>
			{font.name}
		</RN.View>)}
	</RN.View>;
}

export default Fonts;