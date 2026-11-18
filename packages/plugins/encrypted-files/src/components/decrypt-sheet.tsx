import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { ActivityIndicator, Image, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import type { NativeBridge } from '@unbound-app/api/native';
import { format, messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';
import { toasts } from '@unbound-app/api';

import { open, type Opened } from '~/lib/envelope';
import { saveDecrypted } from '~/native/save';
import { toBase64 } from '~/lib/key-text';
import { ownKeys } from '~/lib/keys';

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;
const MIME: Record<string, string> = { png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
const PREVIEW_BYTES = 8 * 1024 * 1024;

type Target = { url: string; bridge: NativeBridge };

type DecryptSheetProps = Target & { onClose: () => void };

type Result = Opened | 'denied' | 'failed';

async function decrypt(url: string): Promise<Result> {
	try {
		const response = await fetch(url);

		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		return open(new Uint8Array(await response.arrayBuffer()), ownKeys()) ?? 'denied';
	} catch (error) {
		logger.error(`Failed to decrypt ${url}:`, error);

		return 'failed';
	}
}

function dataUri({ name, bytes }: Opened): string | undefined {
	if (!IMAGE.test(name) || bytes.byteLength > PREVIEW_BYTES) return undefined;

	const extension = name.split('.').pop()!.toLowerCase();

	return `data:${MIME[extension] ?? 'image/jpeg'};base64,${toBase64(bytes)}`;
}

function DecryptSheet({ url, bridge, onClose }: DecryptSheetProps) {
	const [result, setResult] = useState<Result>();

	useEffect(() => {
		let live = true;

		void decrypt(url).then((next) => live && setResult(next));

		return () => {
			live = false;
		};
	}, [url]);

	async function save(opened: Opened) {
		try {
			const where = await saveDecrypted(bridge, opened.name, opened.bytes);

			toasts.success('SAVED', { where: where ?? opened.name });
			onClose();
		} catch (error) {
			logger.error(`Failed to save decrypted ${opened.name}:`, error);
			toasts.error('SAVE_FAILED', error);
		}
	}

	const preview = typeof result === 'object' ? dataUri(result) : undefined;

	return (
		<Discord.ActionSheet>
			<View style={{ gap: 12, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>{messages.DECRYPT_TITLE}</Discord.Text>
				{!result ? <ActivityIndicator /> : null}
				{result === 'denied' ? (
					<Discord.Text variant='text-md/medium'>{messages.NOT_FOR_YOU}</Discord.Text>
				) : null}
				{result === 'failed' ? (
					<Discord.Text variant='text-md/medium'>{messages.DECRYPT_FAILED}</Discord.Text>
				) : null}
				{typeof result === 'object' ? (
					<>
						<Discord.Text variant='text-md/semibold'>
							{format('FILE_INFO', {
								name: result.name,
								size: Math.ceil(result.bytes.byteLength / 1024),
							})}
						</Discord.Text>
						{preview ? (
							<Image
								source={{ uri: preview }}
								resizeMode='contain'
								style={{ width: '100%', height: 240, borderRadius: 8 }}
							/>
						) : null}
						<Discord.Button text={messages.SAVE} onPress={() => void save(result)} />
					</>
				) : null}
			</View>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that decrypts an encrypted attachment with this device's key.
 * @param target The attachment's link and the plugin's native bridge.
 */
export function openDecryptSheet(target: Target): void {
	openSheet(`unbound-encrypted-files-${target.url}`, DecryptSheet, target);
}

export default DecryptSheet;
