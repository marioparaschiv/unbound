import type { PressableStateCallbackType } from 'react-native';
import { Animated, Pressable, View } from 'react-native';

import { CLIENT_VERSION, REPOSITORY, VERSION } from '~/core/constants';
import { Discord } from '~/metro/components';
import { Linking } from '~/metro/api';
import Logo from '~/ui/icons/logo';

import useStyles from './general-header.style';
import useLogoFloat from './use-logo-float';

/**
 * @description The top of the Unbound page: the floating logo, centred, with Unbound's version and commit under it.
 * Pressing the version opens the commit.
 */
function GeneralHeader() {
	const styles = useStyles();
	const float = useLogoFloat();

	return (
		<View style={styles.header}>
			<Animated.View style={[styles.logo, float]}>
				<Logo height={84} tint={styles.logoTint.color} />
			</Animated.View>
			<Pressable
				accessibilityRole='link'
				hitSlop={8}
				onPress={() =>
					Linking.openURL(`https://github.com/${REPOSITORY}/commit/${VERSION}`)
				}
				style={({ pressed }: PressableStateCallbackType) =>
					pressed ? styles.pressed : null
				}
			>
				<Discord.Text variant='text-sm/medium' color='text-muted'>
					v{CLIENT_VERSION} · {VERSION}
				</Discord.Text>
			</Pressable>
		</View>
	);
}

export default GeneralHeader;
