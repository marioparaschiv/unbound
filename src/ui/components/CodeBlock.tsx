import { Constants, StyleSheet, Theme, ReactNative as RN } from '@metro/common';

interface CodeblockProps {
	selectable?: boolean;
	children: string;
	style?: any;
}

const styles = StyleSheet.createThemedStyleSheet({
	block: {
		fontFamily: Constants.Fonts.CODE_SEMIBOLD,
		fontSize: 12,

		backgroundColor: Theme.colors.BACKGROUND_SECONDARY_ALT,
		color: Theme.colors.TEXT_NORMAL,

		padding: 10
	}
});

const IosBlock = ({ children, style, ...rest }: CodeblockProps) => {
	return <RN.TextInput
		value={children}
		style={[styles.block, style]}
		editable={false}
		multiline
		{...rest}
	/>;
};

const AndroidBlock = ({ selectable, children, style, ...rest }: CodeblockProps) => {
	return <RN.Text
		children={children}
		style={[styles.block, style]}
		selectable={selectable}
		{...rest}
	/>;
};

export default ({ selectable, ...props }: CodeblockProps) => {
	if (!selectable) return <AndroidBlock selectable={selectable} {...props} />;

	return RN.Platform.select({
		ios: <IosBlock {...props} />,
		default: <AndroidBlock selectable={selectable} {...props} />
	});
};