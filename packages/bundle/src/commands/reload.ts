import type { ApplicationCommand } from '@unbound-app/types/api/commands';
import { reload } from '~/api/native';


export default {
	name: 'reload',
	description: 'Reloads the app.',

	execute: () => reload()
} as ApplicationCommand;