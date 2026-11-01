import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScrollView, Text, View } from 'react-native';
import { useState } from 'react';

import { bugReportURL, describeError } from '~/ui/error-fallback';
import type { CaughtError } from '~/ui/error-fallback';
import { Clipboard } from '~/metro/common';
import { messages } from '~/i18n/api';
import { Linking } from '~/metro/api';

import styles from './error-boundary.style';
import ErrorSection from './error-section';
import ErrorAction from './error-action';

export type ErrorFallbackProps = CaughtError & {
	clientVersion: string;
	platform: string;
	onRetry: () => void;
	onReload: () => void;
	onRecovery: () => void;
};

/**
 * @description The screen shown when Discord's error boundary catches a crash: the error, its stacks
 * collapsed, and ways to recover or report it. Built from React Native primitives so it still renders
 * when the crash came from Discord's own components.
 */
function ErrorFallback({
	error,
	componentStack,
	clientVersion,
	platform,
	onRetry,
	onReload,
	onRecovery,
}: ErrorFallbackProps) {
	const [copied, setCopied] = useState(false);
	const caught = { error, componentStack };

	return (
		<View style={styles.screen}>
			<ScrollView contentContainerStyle={styles.content}>
				<Animated.View entering={FadeInDown.duration(320)} style={{ gap: 16 }}>
					<Text style={styles.title}>{messages.UNBOUND_CRASH_TITLE}</Text>
					<Text style={styles.subtitle}>{messages.UNBOUND_CRASH_DESCRIPTION}</Text>
					<View style={styles.errorCard}>
						<Text style={styles.errorName}>{error?.name || 'Error'}</Text>
						<Text selectable style={styles.errorMessage}>
							{error?.message ?? String(error)}
						</Text>
					</View>
					{error?.stack ? (
						<ErrorSection title={messages.UNBOUND_CRASH_STACK} text={error.stack} />
					) : null}
					{componentStack?.trim() ? (
						<ErrorSection
							title={messages.UNBOUND_CRASH_COMPONENT_STACK}
							text={componentStack.trim()}
						/>
					) : null}
				</Animated.View>
				<Animated.View
					entering={FadeInDown.delay(120).duration(320)}
					style={styles.actions}
				>
					<ErrorAction label={messages.UNBOUND_CRASH_RETRY} primary onPress={onRetry} />
					<ErrorAction label={messages.UNBOUND_CRASH_RELOAD} onPress={onReload} />
					<ErrorAction label={messages.UNBOUND_CRASH_RECOVERY} onPress={onRecovery} />
					<ErrorAction
						label={copied ? messages.UNBOUND_CRASH_COPIED : messages.UNBOUND_CRASH_COPY}
						onPress={() => {
							Clipboard.setString(describeError(caught));
							setCopied(true);
						}}
					/>
					<ErrorAction
						label={messages.UNBOUND_CRASH_REPORT}
						onPress={() =>
							Linking.openURL(bugReportURL(caught, { clientVersion, platform }))
						}
					/>
				</Animated.View>
			</ScrollView>
		</View>
	);
}

export default ErrorFallback;
