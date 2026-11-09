import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScrollView } from 'react-native';
import { useState } from 'react';

import { bugReportURL, crashDiagnostics, pluginsLine } from '~/ui/error-fallback';
import { readDebugInfo } from '~/diagnostics/debug-report';
import { Discord, SafeArea } from '~/metro/components';
import type { CaughtError } from '~/ui/error-fallback';
import { getAll as getPlugins } from '~/plugins/api';
import { Clipboard } from '~/metro/common';
import { messages } from '~/i18n/api';
import { Linking } from '~/metro/api';
import { icons } from '~/assets/api';

import useStyles from './error-boundary.style';
import ErrorDetails from './error-details';
import ErrorAction from './error-action';
import ErrorHeader from './error-header';

export type ErrorFallbackProps = CaughtError & {
	clientVersion: string;
	platform: string;
	/** Whether Discord already runs in recovery mode, which hides the action that enters it. */
	recovery: boolean;
	onRetry: () => void;
	onReload: () => void;
	onRecovery: () => void;
};

/**
 * @description The screen shown when Discord's error boundary catches a crash: what happened beside the
 * Unbound logo, the error with its traces, and ways to recover or report it, on Discord's cards.
 */
function ErrorFallback({
	error,
	componentStack,
	clientVersion,
	platform,
	recovery,
	onRetry,
	onReload,
	onRecovery,
}: ErrorFallbackProps) {
	const styles = useStyles();
	const caught = { error, componentStack };
	const [copied, setCopied] = useState(false);

	function copyDiagnostics() {
		const enabled = getPlugins().filter((plugin) => plugin.isEnabled());

		Clipboard.setString(
			crashDiagnostics(caught, readDebugInfo(), pluginsLine(enabled, recovery)),
		);
		setCopied(true);
	}

	return (
		<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
			<SafeArea.SafeAreaPaddingView top bottom>
				<Discord.Stack spacing={12}>
					<Animated.View entering={FadeInDown.duration(320)}>
						<ErrorHeader />
					</Animated.View>
					<Animated.View entering={FadeInDown.delay(60).duration(320)}>
						<ErrorDetails error={error} componentStack={componentStack} />
					</Animated.View>
					<Animated.View entering={FadeInDown.delay(120).duration(320)}>
						<Discord.Stack spacing={12}>
							<Discord.Button
								size='lg'
								variant='primary'
								text={messages.UNBOUND_CRASH_RETRY}
								icon={icons.RetryIcon}
								iconPosition='start'
								onPress={onRetry}
							/>
							<Discord.Button
								size='lg'
								variant='secondary'
								text={
									copied
										? messages.UNBOUND_CRASH_COPIED
										: messages.UNBOUND_CRASH_COPY
								}
								icon={copied ? icons.CheckmarkLargeIcon : icons.CopyIcon}
								iconPosition='start'
								onPress={copyDiagnostics}
							/>
							<Discord.Stack direction='horizontal' spacing={8}>
								<ErrorAction
									label={messages.UNBOUND_CRASH_RELOAD}
									icon='RefreshIcon'
									onPress={onReload}
								/>
								{recovery ? null : (
									<ErrorAction
										label={messages.UNBOUND_CRASH_RECOVERY}
										icon='ShieldIcon'
										onPress={onRecovery}
									/>
								)}
								<ErrorAction
									label={messages.UNBOUND_CRASH_REPORT}
									icon='BugIcon'
									onPress={() =>
										Linking.openURL(
											bugReportURL(caught, { clientVersion, platform }),
										)
									}
								/>
							</Discord.Stack>
						</Discord.Stack>
					</Animated.View>
				</Discord.Stack>
			</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default ErrorFallback;
