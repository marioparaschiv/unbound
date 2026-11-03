import { createElement, memo } from 'react';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';

import useStyles from './toast.style';

type ToastContentProps = {
	title?: string | ComponentType;
	content?: string;
};

function ToastContent({ title, content }: ToastContentProps) {
	const styles = useStyles();

	return (
		<View style={styles.contentContainer}>
			{title ? (
				typeof title === 'function' ? (
					createElement(title)
				) : (
					<Discord.Text variant='text-sm/semibold'>{title}</Discord.Text>
				)
			) : null}
			{content ? (
				<Discord.Text style={styles.content} variant='text-sm/normal' color='text-muted'>
					{content}
				</Discord.Text>
			) : null}
		</View>
	);
}

export default memo(ToastContent);
