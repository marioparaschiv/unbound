import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';
import { View } from 'react-native';
import type { ComponentType } from 'react';

const PAGE_ROUTE = 'UNBOUND_CUSTOM';
const QR_SIZE = 260;

function QRPage({ link }: { link: string }) {
	const QRCode = metro.findByFilePath('components_native/QRCode.tsx', { interop: false })
		?.default as ComponentType<{ text: string; size: number }> | undefined;

	return (
		<View style={{ width: '100%', padding: 24, alignItems: 'center', gap: 16 }}>
			{QRCode ? (
				<View style={{ alignSelf: 'center' }}>
					<QRCode text={link} size={QR_SIZE} />
				</View>
			) : null}
			<Discord.Text variant='text-sm/medium' color='text-muted' selectable>
				{link}
			</Discord.Text>
		</View>
	);
}

/**
 * @description Shows a link as a QR code on its own page.
 * @param link The link.
 */
export function openQrPage(link: string): void {
	metro
		.findByProps('getRootNavigationRef')
		?.getRootNavigationRef()
		.navigate('settings', {
			screen: PAGE_ROUTE,
			params: { title: messages.QR_CODE, render: () => <QRPage link={link} /> },
		});
}

export default openQrPage;
