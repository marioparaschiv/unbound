import { Discord } from '@unbound-app/api/metro/components';
import type { ComponentType } from 'react';
import { Linking, View } from 'react-native';

import { playerUrl, staysInPlayer } from '~/lib/soundcloud';

type Navigation = { url: string };

export type WebViewProps = {
	source: { uri: string };
	style?: unknown;
	allowsInlineMediaPlayback?: boolean;
	mediaPlaybackRequiresUserAction?: boolean;
	onShouldStartLoadWithRequest?: (navigation: Navigation) => boolean;
};

export type PlayerSheetProps = { link: string; WebView: ComponentType<WebViewProps> };

const PLAYER_HEIGHT = 420;

function routeNavigation({ url }: Navigation): boolean {
	if (staysInPlayer(url)) return true;

	Linking.openURL(url).catch((error: unknown) =>
		logger.error(`Failed to open link ${url}:`, error),
	);

	return false;
}

/**
 * @description Plays a SoundCloud track or playlist in SoundCloud's embedded player, in a sheet over the chat.
 * @param props The link and Discord's `WebView` component.
 * @returns The sheet.
 */
export function PlayerSheet({ link, WebView }: PlayerSheetProps) {
	return (
		<Discord.ActionSheet>
			<View
				style={{
					height: PLAYER_HEIGHT,
					marginHorizontal: 16,
					marginBottom: 16,
					borderRadius: 12,
					overflow: 'hidden',
				}}
			>
				<WebView
					source={{ uri: playerUrl(link) }}
					style={{ flex: 1, backgroundColor: 'transparent' }}
					allowsInlineMediaPlayback
					mediaPlaybackRequiresUserAction={false}
					onShouldStartLoadWithRequest={routeNavigation}
				/>
			</View>
		</Discord.ActionSheet>
	);
}

export default PlayerSheet;
