import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { interceptLivePhotos } from '~/flux/uploads';

const interceptOnPlatform = native.definePlatform({ ios: interceptLivePhotos });

export function start(context: PluginContext) {
	interceptOnPlatform(context.native, context.tempPath);
}
