import {
	javaInt,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge } from '@unbound-app/api/native';

import type { VoiceFile } from '~/lib/voice-message';

const VISIBLE_NOTIFY_COMPLETED = 1;

export async function saveOnAndroid({ java }: NativeBridge, file: VoiceFile): Promise<void> {
	const uri = javaReference(
		java.invoke(java.getClass('android.net.Uri'), 'parse', [javaString(file.url)]),
	);
	const request = java.construct('android.app.DownloadManager$Request', [uri!]);

	java.invoke(request, 'setNotificationVisibility', [javaInt(VISIBLE_NOTIFY_COMPLETED)]);
	java.invoke(request, 'setDestinationInExternalPublicDir', [
		javaString('Download'),
		javaString(file.filename),
	]);

	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);
	const downloads = javaReference(
		java.invoke(app!, 'getSystemService', [javaString('download')]),
	);

	java.invoke(downloads!, 'enqueue', [request]);
}
