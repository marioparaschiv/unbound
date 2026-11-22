import { currentApplication } from '@unbound-plugins/shared/native/android/views';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge } from '@unbound-app/api/native';

const DISCORD_PACKAGE = 'com.discord';

function opensAsDescriptor(native: NativeBridge, name: string): boolean {
	const { java } = native;
	const application = currentApplication(java);
	const resources = application
		? javaReference(java.invoke(application, 'getResources', []))
		: null;

	if (!resources) return false;

	const id =
		javaNumber(
			java.invoke(resources, 'getIdentifier', [
				javaString(name),
				javaString('raw'),
				javaString(DISCORD_PACKAGE),
			]),
		) ?? 0;

	if (!id) return false;

	try {
		const descriptor = javaReference(
			java.invoke(resources, 'openRawResourceFd', [javaInt(id)]),
		);

		if (descriptor) java.invoke(descriptor, 'close', []);

		return Boolean(descriptor);
	} catch {
		return false;
	}
}

/**
 * @description Checks which of Discord's sounds its Android SoundManager can open, since it crashes on a compressed one.
 * @param native The plugin's native bridge.
 * @returns A check that answers once per sound name.
 */
export function playableSoundAndroid(native: NativeBridge): (name: string) => boolean {
	const answers = new Map<string, boolean>();

	return (name) => {
		const known = answers.get(name);

		if (known !== undefined) return known;

		let playable = false;

		try {
			playable = opensAsDescriptor(native, name);
		} catch (error) {
			logger.warn(`Failed to check Discord's sound ${name}:`, error);
		}

		answers.set(name, playable);

		return playable;
	};
}

export default playableSoundAndroid;
