import { cli } from 'cleye';


const argv = cli({
	name: 'ub-debugger',
	flags: {
		port: {
			type: Number,
			description: 'The port number to host the debugger on.',
			default: 9090
		}
	}
});

export default argv;