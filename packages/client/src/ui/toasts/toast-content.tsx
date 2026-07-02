import { createElement, memo } from 'react';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import { Discord } from '~/api/metro/components';

import useStyles from './toast.style';

type ToastContentProps = {
	title?: string | ComponentType;
	content?: string;
};

type FieldProps = {
	value: string | ComponentType;
	[key: string]: any;
};

function Field({ value, ...props }: FieldProps) {
	if (typeof value === 'function') return createElement(value);
	return <Discord.Text {...props}>{value}</Discord.Text>;
}

function ToastContent({ title, content }: ToastContentProps) {
	const styles = useStyles();

	return (
		<View style={styles.contentContainer}>
			{title ? <Field value={title} variant='text-sm/semibold' /> : null}
			{content ? (
				<Field
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
