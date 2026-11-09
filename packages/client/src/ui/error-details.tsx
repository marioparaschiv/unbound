import { Dimensions, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';

import type { CaughtError } from '~/ui/error-fallback';
import { readableStack } from '~/ui/error-fallback';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import useStyles from './error-boundary.style';

/**
 * @description The crash screen's error card: the error's name and message, a switch between its component
 * stack and stack trace, and the picked trace.
 */
function ErrorDetails({ error, componentStack }: CaughtError) {
	const styles = useStyles();
	const [index, setIndex] = useState(0);

	const traces = [
		{
			id: 'component',
			label: messages.UNBOUND_CRASH_COMPONENT_STACK,
			text: componentStack && readableStack(componentStack),
		},
		{
			id: 'stack',
			label: messages.UNBOUND_CRASH_STACK,
			text: error?.stack && readableStack(error.stack),
		},
	].filter((trace) => trace.text);

	const state = Discord.useSegmentedControlState({
		items: traces.map(({ id, label }) => ({ id, label })),
		pageWidth: Dimensions.get('window').width,
		onSetActiveIndex: setIndex,
	});

	const trace = traces[index] ?? traces[0];

	return (
		<Discord.Card variant='primary' border='subtle' shadow='low' style={styles.card}>
			<Discord.Text variant='text-xs/bold' style={styles.errorName}>
				{error?.name || 'Error'}
			</Discord.Text>
			<Discord.Text variant='text-md/semibold' color='mobile-text-heading-primary' selectable>
				{error?.message ?? String(error)}
			</Discord.Text>
			{traces.length > 1 ? <Discord.SegmentedControl state={state} /> : null}
			{trace ? (
				<View style={styles.code}>
					<ScrollView nestedScrollEnabled contentContainerStyle={styles.codeContent}>
						<Text selectable style={styles.codeText}>
							{trace.text}
						</Text>
					</ScrollView>
				</View>
			) : null}
		</Discord.Card>
	);
}

export default ErrorDetails;
