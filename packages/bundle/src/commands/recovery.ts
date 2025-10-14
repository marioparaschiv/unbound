import type { ApplicationCommand } from '@unbound-app/types/api/commands';
import { getStore } from '~/api/storage';
import { reload } from '~/api/native';


const settings = getStore('unbound');

export default {
	name: 'recovery',
	description: 'Toggle recovery mode and reload the app.',

	execute: () => {
		settings.toggle('recovery', false);
		reload(false);
	}
} as ApplicationCommand;