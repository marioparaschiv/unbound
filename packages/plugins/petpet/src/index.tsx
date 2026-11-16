import type { PluginContext } from '@unbound-app/api/native';

import { patchActionSheets } from '~/patches';
import { registerPetPet } from '~/commands';

export function start(context: PluginContext) {
	registerPetPet(context.native, context.tempPath);
	patchActionSheets(context.native, context.tempPath);
}
