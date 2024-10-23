import { Platform, TextInput, Text } from 'react-native';

import useStyles from './codeblock.style';


interface CodeblockProps {
	selectable?: boolean;
	children: string;
	style?: any;
}

function IosBlock({ children, style, ...rest }: CodeblockProps) {
	const styles = useStyles();

	return <TextInput
		value={children}
		style={[styles.block, style]}
		editable={false}
		multiline
		{...rest}
	/>;
};

function AndroidBlock({ selectable, children, style, ...rest }: CodeblockProps) {
	const styles = useStyles();

	return <Text
		style={[styles.block, style]}
		selectable={selectable}
		{...rest}
	>
		{children}
	</Text>;
};

export default function CodeBlock({ selectable, ...props }: CodeblockProps) {
	if (!selectable) return <AndroidBlock selectable={selectable} {...props} />;

	return Platform.select({
		ios: <IosBlock {...props} />,
		default: <AndroidBlock selectable={selectable} {...props} />
	});
};