import { Image, View } from 'react-native';
import type { ReactNode } from 'react';

import { SafeAreaContext } from '~/metro/components';
import ThemeStore from '~/themes/state';

import useStyles from './chat-backdrop.style';

type ChatBackdropProps = {
	/** Discord's chat view, drawn over the image. */
	children: ReactNode;
};

/**
 * @description Draws the chat background image under Discord's chat view, down through the bottom safe area that the
 * channel screen leaves clear below it. The frame stays mounted without an image, so turning a background on or off
 * keeps the chat's scroll position.
 */
function ChatBackdrop({ children }: ChatBackdropProps) {
	const styles = useStyles();
	const background = ThemeStore((state) => state.background);
	const { bottom } = SafeAreaContext.useSafeAreaInsets();

	return (
		<View style={styles.frame}>
			{background ? (
				<Image
					source={{ uri: background.url }}
					blurRadius={background.blur}
					resizeMode='cover'
					style={[styles.image, { bottom: -bottom }]}
				/>
			) : null}
			{children}
		</View>
	);
}

export default ChatBackdrop;
