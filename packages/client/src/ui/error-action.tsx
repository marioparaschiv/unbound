import { Pressable, Text } from 'react-native';

import styles from './error-boundary.style';

type ErrorActionProps = {
	label: string;
	primary?: boolean;
	onPress: () => void;
};

function ErrorAction({ label, primary, onPress }: ErrorActionProps) {
	return (
		<Pressable
			accessibilityRole='button'
			onPress={onPress}
			style={[styles.button, primary ? styles.primaryButton : null]}
		>
			<Text style={[styles.buttonText, primary ? styles.primaryButtonText : null]}>
				{label}
			</Text>
		</Pressable>
	);
}

export default ErrorAction;
