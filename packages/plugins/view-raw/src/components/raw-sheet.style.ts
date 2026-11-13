import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => {
	const { Theme, Constants } = metro.common;

	return {
		container: { maxHeight: '85%', paddingHorizontal: 16, paddingBottom: 18, rowGap: 8 },
		code: {
			backgroundColor: Theme.colors?.BACKGROUND_CODE,
			borderColor: Theme.colors?.BORDER_SUBTLE,
			borderWidth: 1,
			borderRadius: Theme.radii?.sm,
			color: Theme.colors?.TEXT_DEFAULT,
			fontFamily: Constants.Fonts?.CODE_NORMAL,
			fontSize: 13,
			padding: 12,
			textAlignVertical: 'top',
		},
		content: { height: 96 },
		data: { maxHeight: 480 },
		heading: { marginTop: 8 },
		buttons: { flexDirection: 'row', columnGap: 8, marginTop: 8 },
		button: { flex: 1 },
	};
});
