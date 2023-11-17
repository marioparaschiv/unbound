import { Constants, StyleSheet, Theme, React, ReactNative as RN } from '@metro/common';

interface CodeblockProps {
	selectable?: boolean;
	children: string;
	style?: any;
}

const useStyles = StyleSheet.createStyles({
	block: {
		fontFamily: Constants.Fonts.CODE_SEMIBOLD,
		fontSize: 12,

		backgroundColor: Theme.colors.BACKGROUND_SECONDARY_ALT,
		color: Theme.colors.TEXT_NORMAL,

		padding: 10
	}
});

function IosBlock({ children, style, ...rest }: CodeblockProps) {
	const styles = useStyles();

	return <RN.TextInput
		value={children}
		style={[styles.block, style]}
		editable={false}
		multiline
		{...rest}
	/>;
};

function AndroidBlock({ selectable, children, style, ...rest }: CodeblockProps) {
	const styles = useStyles();

	return <RN.Text
		style={[styles.block, style]}
		selectable={selectable}
		{...rest}
	>
		{children}
	</RN.Text>;
};

export default function CodeBlock({ selectable, ...props }: CodeblockProps) {
	if (!selectable) return <AndroidBlock selectable={selectable} {...props} />;

	return RN.Platform.select({
		ios: <IosBlock {...props} />,
		default: <AndroidBlock selectable={selectable} {...props} />
	});
};