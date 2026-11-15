import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';
import { ScrollView, View } from 'react-native';

const PAGE_ROUTE = 'UNBOUND_CUSTOM';

type Clipboard = { setString(text: string): void };

const Clipboard: Clipboard | undefined = metro.findByProps('setString', 'getString', {
	lazy: true,
});

function TranscriptPage({ text }: { text: string }) {
	return (
		<ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
			<View>
				<Discord.Text variant='text-md/normal' color='text-default' selectable>
					{text}
				</Discord.Text>
			</View>
			<Discord.Button
				text={messages.COPY}
				onPress={() => {
					Clipboard?.setString(text);
					toasts.show({ title: addon.name, content: messages.COPIED });
				}}
			/>
		</ScrollView>
	);
}

/**
 * @description Shows a transcript on its own page, selectable, with a button that copies it.
 * @param text The transcript.
 */
export function openTranscript(text: string): void {
	metro
		.findByProps('getRootNavigationRef')
		?.getRootNavigationRef()
		.navigate('settings', {
			screen: PAGE_ROUTE,
			params: { title: messages.TRANSCRIPT, render: () => <TranscriptPage text={text} /> },
		});
}

export default openTranscript;
