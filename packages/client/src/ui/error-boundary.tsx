import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useState } from 'react';

import { bugReportURL, describeError } from '~/ui/error-fallback';
import type { CaughtError } from '~/ui/error-fallback';
import { Clipboard } from '~/api/metro/common';
import { Linking } from '~/api/metro/api';
import { Messages } from '~/api/i18n';

import styles from './error-boundary.style';

export type ErrorFallbackProps = CaughtError & {
	clientVersion: string;
	platform: string;
	onRetry: () => void;
	onReload: () => void;
	onRecovery: () => void;
};

type SectionProps = {
	title: string;
	text: string;
};

type ActionProps = {
	label: string;
	primary?: boolean;
	onPress: () => void;
};

function Section({ title, text }: SectionProps) {
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

function Action({ label, primary, onPress }: ActionProps) {
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
					<Text style={styles.title}>{Messages.UNBOUND_CRASH_TITLE}</Text>
					<Text style={styles.subtitle}>{Messages.UNBOUND_CRASH_DESCRIPTION}</Text>
					<View style={styles.errorCard}>
						<Text style={styles.errorName}>{error?.name || 'Error'}</Text>
						<Text selectable style={styles.errorMessage}>
							{error?.message ?? String(error)}
						</Text>
					</View>
					{error?.stack ? (
						<Section title={Messages.UNBOUND_CRASH_STACK} text={error.stack} />
					) : null}
					{componentStack?.trim() ? (
						<Section
							title={Messages.UNBOUND_CRASH_COMPONENT_STACK}
							text={componentStack.trim()}
						/>
					) : null}
				</Animated.View>
				<Animated.View
					entering={FadeInDown.delay(120).duration(320)}
					style={styles.actions}
				>
					<Action label={Messages.UNBOUND_CRASH_RETRY} primary onPress={onRetry} />
					<Action label={Messages.UNBOUND_CRASH_RELOAD} onPress={onReload} />
					<Action label={Messages.UNBOUND_CRASH_RECOVERY} onPress={onRecovery} />
					<Action
						label={copied ? Messages.UNBOUND_CRASH_COPIED : Messages.UNBOUND_CRASH_COPY}
						onPress={() => {
							Clipboard.setString(describeError(caught));
							setCopied(true);
						}}
					/>
					<Action
						label={Messages.UNBOUND_CRASH_REPORT}
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
