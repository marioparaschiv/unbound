import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { Messages } from '~/i18n/api';

import styles from './error-boundary.style';

type ErrorSectionProps = {
	title: string;
	text: string;
};

function ErrorSection({ title, text }: ErrorSectionProps) {
	const [open, setOpen] = useState(false);

	return (
		<View style={styles.errorCard}>
			<Pressable
				accessibilityRole='button'
				onPress={() => setOpen(!open)}
				style={styles.sectionHeader}
			>
				<Text style={styles.sectionTitle}>{title}</Text>
				<Text style={styles.sectionToggle}>
					{open ? Messages.UNBOUND_CRASH_HIDE : Messages.UNBOUND_CRASH_SHOW}
				</Text>
			</Pressable>
			{open ? (
				<Text selectable style={styles.trace}>
					{text}
				</Text>
			) : null}
		</View>
	);
}

export default ErrorSection;
