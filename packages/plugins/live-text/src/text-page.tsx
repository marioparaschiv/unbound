import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';
import { ScrollView, View } from 'react-native';

const PAGE_ROUTE = 'UNBOUND_CUSTOM';

type Clipboard = { setString(text: string): void };

const Clipboard: Clipboard | undefined = metro.findByProps('setString', 'getString', {
	lazy: true,
});

function copy(text: string) {
	Clipboard?.setString(text);
	toasts.show({ title: addon.name, content: messages.COPIED });
}

function TextPage({ lines }: { lines: string[] }) {
	const text = lines.join('\n');

	return (
		<ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
			<Discord.Button text={messages.COPY_ALL} onPress={() => copy(text)} />
			<View>
				<Discord.Text variant='text-md/normal' color='text-default' selectable>
					{text}
				</Discord.Text>
			</View>
		</ScrollView>
	);
}

/**
 * @description Shows the text read from an image on its own page, selectable, with a button that copies it all.
 * @param lines The lines read from the image.
 */
export function openTextPage(lines: string[]): void {
	metro
		.findByProps('getRootNavigationRef')
		?.getRootNavigationRef()
		.navigate('settings', {
			screen: PAGE_ROUTE,
			params: { title: messages.TEXT_IN_IMAGE, render: () => <TextPage lines={lines} /> },
		});
}

export default openTextPage;
