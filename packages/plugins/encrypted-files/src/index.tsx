import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchActionSheets, patchComposer } from '~/patches';
import { useSecureRandom } from '~/native/random';
import { encryptUploads } from '~/flux/uploads';
import { ownKeys } from '~/lib/keys';
import SettingsPanel from '~/settings';

let stopEncrypting: (() => void) | undefined;

export function start(context: PluginContext) {
	if (!useSecureRandom(context.native)) {
		logger.error('Failed to start Encrypted Files: no secure random source on this platform.');

		return;
	}

	ownKeys();
	patchComposer();
	patchActionSheets(context.native);
	stopEncrypting = encryptUploads(context.tempPath);
}

export function stop() {
	stopEncrypting?.();
	stopEncrypting = undefined;
	patcher.unpatchAll();
}

export { SettingsPanel };
