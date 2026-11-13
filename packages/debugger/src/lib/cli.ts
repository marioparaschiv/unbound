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
		idleTimeout: {
			type: Number,
			description:
				'Seconds to keep running with no controller attached before exiting; 0 never exits. Ignored in an interactive terminal, whose REPL counts as a controller.',
			default: 60,
		},
	},
});

export default argv;
