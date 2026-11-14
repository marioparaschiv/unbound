import type { NativeBridge } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';
import { Share } from 'react-native';

import { toBase64, type VoiceFile } from '~/lib/voice-message';

// iOS: written to the documents folder and offered in the share sheet, whose Save to Files keeps it.
export async function saveOnIOS(_native: NativeBridge, file: VoiceFile): Promise<void> {
	const response = await fetch(file.url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const bytes = new Uint8Array(await response.arrayBuffer());

	await fs.writeFile(file.filename, toBase64(bytes), 'base64');
	await Share.share({ url: `file://${fs.documentsPath}/${file.filename}` });
}
