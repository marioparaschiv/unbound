import { Discord } from '@unbound-app/api/metro/components';
import type { ComponentType } from 'react';
import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';
import { View } from 'react-native';

import { staysOnGame } from '~/lib/navigation';
import { DOOM_URL } from '~/lib/constants';

type WebViewProps = {
	source: { uri: string };
	style?: object;
	javaScriptEnabled?: boolean;
	allowsInlineMediaPlayback?: boolean;
	mediaPlaybackRequiresUserAction?: boolean;
	onShouldStartLoadWithRequest?: (request: { url: string }) => boolean;
};

const PAGE_ROUTE = 'UNBOUND_CUSTOM';

function webView(): ComponentType<WebViewProps> | undefined {
	const exports = metro.findByProps('WebView', { interop: false }) as
		| {
				WebView?: ComponentType<WebViewProps>;
				default?: { WebView?: ComponentType<WebViewProps> };
		  }
		| undefined;

	return exports?.WebView ?? exports?.default?.WebView;
}

function Game() {
	const WebView = webView();

	if (!WebView) {
		return (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
				<Discord.Text variant='text-md/medium'>{messages.NO_WEBVIEW}</Discord.Text>
			</View>
		);
	}

	return (
		<WebView
			source={{ uri: DOOM_URL }}
			style={{ flex: 1, backgroundColor: '#000' }}
			javaScriptEnabled
			allowsInlineMediaPlayback
			mediaPlaybackRequiresUserAction={false}
			onShouldStartLoadWithRequest={(request) => staysOnGame(request.url)}
		/>
	);
}

/**
 * @description Opens DOOM on its own page above everything; closing the page unmounts the game.
 */
export function openDoom(): void {
	metro
		.findByProps('getRootNavigationRef')
		?.getRootNavigationRef()
		.navigate('settings', {
			screen: PAGE_ROUTE,
			params: { title: messages.DOOM, render: () => <Game /> },
		});
}

export default openDoom;
