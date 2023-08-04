import type { ApplicationCommand } from '@typings/api/commands';
import { BundleManager } from '@api/native';

export default {
	name: 'reload',
	description: 'Reloads the unbound client to apply changes.',

	execute: BundleManager.reload
} as ApplicationCommand;