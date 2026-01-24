import type { UnboundCommand } from '@unbound-app/types/commands';
import { reload } from '~/api/native';


export default {
	name: 'reload',
	description: 'Reloads the app.',

	execute: () => reload()
} as UnboundCommand;