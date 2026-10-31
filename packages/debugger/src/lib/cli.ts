import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { cli } from 'cleye';

const argv = cli({
	name: 'ub-debugger',
	flags: {
		port: {
			type: Number,
			description: 'The port number to host the debugger on.',
			default: DEFAULT_BRIDGE_PORT,
		},
	},
});

export default argv;
