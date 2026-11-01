import type { PressableStateCallbackType } from 'react-native';
import { Animated, Pressable, View } from 'react-native';

import { CLIENT_NAME, CLIENT_VERSION, REPOSITORY, VERSION } from '~/core/constants';
import { Discord } from '~/metro/components';
import { Linking } from '~/metro/api';
import Logo from '~/ui/icons/logo';

import GeneralHeaderBackdrop from './general-header-backdrop';
import GeneralHeaderShine from './general-header-shine';
import useBannerMotion from './use-banner-motion';
import useStyles from './general-header.style';

/**
 * @description The banner atop the Unbound page: the floating logo on a graphite dotted backdrop, then
 * Unbound's version and commit. Pressing it opens the commit.
 */
function GeneralHeader() {
	const styles = useStyles();
	const motion = useBannerMotion();

	return (
		<Pressable
			accessibilityRole='link'
			onPress={() => Linking.openURL(`https://github.com/${REPOSITORY}/commit/${VERSION}`)}
			style={({ pressed }: PressableStateCallbackType) => [
				styles.banner,
				pressed ? styles.pressed : null,
			]}
		>
			<GeneralHeaderBackdrop />
			<GeneralHeaderShine style={motion.shine} />
			<Animated.View style={[styles.logo, motion.logo]}>
				<Logo height={64} />
			</Animated.View>
			<View style={styles.text}>
				<Discord.Text variant='heading-xxl/bold' style={styles.title}>
					{CLIENT_NAME}
				</Discord.Text>
				<View style={styles.meta}>
					<Discord.Text variant='text-xs/semibold' style={styles.version}>
						v{CLIENT_VERSION}
					</Discord.Text>
					<View style={styles.divider} />
					<Discord.Text variant='text-xs/medium' style={styles.revision}>
						{VERSION}
					</Discord.Text>
				</View>
			</View>
		</Pressable>
	);
}

export default GeneralHeader;
