import type { ComponentType } from 'react';
import { View } from 'react-native';
import { memo } from 'react';

import ToastField from './toast-field';
import useStyles from './toast.style';

type ToastContentProps = {
	title?: string | ComponentType;
	content?: string;
};

function ToastContent({ title, content }: ToastContentProps) {
	const styles = useStyles();

	return (
		<View style={styles.contentContainer}>
			{title ? <ToastField value={title} variant='text-sm/semibold' /> : null}
			{content ? (
				<ToastField
					value={content}
					style={styles.content}
					variant='text-sm/normal'
					color='text-muted'
				/>
			) : null}
		</View>
	);
}

export default memo(ToastContent);
