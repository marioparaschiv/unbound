import type { ApplicationCommand } from '@typings/api/commands';
import { BundleManager } from '@api/native';
import { getStore } from '@api/storage';

const settings = getStore('unbound');

export default {
	name: 'recovery',
	description: 'Toggles recovery mode and reloads unbound.',

	execute: () => {
		settings.set('recovery', true);
		BundleManager.reload();
	}
} as ApplicationCommand;