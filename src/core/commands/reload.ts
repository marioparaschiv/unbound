import type { ApplicationCommand } from '@typings/api/commands';
import { reload } from '@api/native';

export default {
	name: 'reload',
	description: 'Reloads the app.',

	execute: () => reload()
} as ApplicationCommand;