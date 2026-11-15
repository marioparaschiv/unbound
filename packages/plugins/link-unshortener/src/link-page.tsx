import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';
import { Linking, View } from 'react-native';

import type { Resolved } from '~/lib/shorteners';

const PAGE_ROUTE = 'UNBOUND_CUSTOM';

type Clipboard = { setString(text: string): void };

const Clipboard: Clipboard | undefined = metro.findByProps('setString', 'getString', {
	lazy: true,
});

function LinkPage({ resolved }: { resolved: Resolved }) {
	return (
		<View style={{ padding: 16, gap: 16 }}>
			<Discord.Text variant='text-md/medium' color='text-default' selectable>
				{resolved.url}
			</Discord.Text>
			<Discord.Text variant='text-sm/normal' color='text-muted'>
				{format('REDIRECTS', { count: resolved.redirects })}
			</Discord.Text>
			<Discord.Button
				text={messages.OPEN}
				onPress={() => void Linking.openURL(resolved.url)}
			/>
			<Discord.Button
				text={messages.COPY}
				variant='secondary'
				onPress={() => {
					Clipboard?.setString(resolved.url);
					toasts.show({ title: addon.name, content: messages.COPIED });
				}}
			/>
		</View>
	);
}

/**
 * @description Shows where a short link goes on its own page, with buttons to open or copy it.
 * @param resolved The final address and redirect count.
 */
export function openLinkPage(resolved: Resolved): void {
	metro
		.findByProps('getRootNavigationRef')
		?.getRootNavigationRef()
		.navigate('settings', {
			screen: PAGE_ROUTE,
			params: { title: messages.REAL_LINK, render: () => <LinkPage resolved={resolved} /> },
		});
}
