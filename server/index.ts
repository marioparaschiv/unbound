import os from 'node:os';


console.clear();

const BASE_PATH = './dist';
const PORT = Bun.argv[2] ?? 8080;

const getCurrentDate = () => new Date().toTimeString().split(' ')[0];
const getLocalIp = () => {
	const interfaces = os.networkInterfaces();

	for (const ifaces of Object.values(interfaces)) {
		if (!ifaces) continue;

		for (const iface of ifaces) {
			// Skip over internal (i.e., 127.0.0.1) and non-IPv4 addresses
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
};

Bun.serve({
	port: PORT,

	async fetch(req) {
		const filePath = BASE_PATH + new URL(req.url).pathname;
		const file = Bun.file(filePath);

		console.info([
			'',
			`Yielding file:`,
			`File: ${filePath}`,
			`URL: ${req.url}`,
			`Time: ${getCurrentDate()}`
		].join('\n'));

		return new Response(file);
	},

	error() {
		return new Response(null, { status: 404 });
	},
});

if (getLocalIp()) {
	console.log(`Listening on ${getLocalIp()}:${PORT}. The time is ${getCurrentDate()}.`);
} else {
	console.log(`Listening on port ${PORT}. The time is ${getCurrentDate()}.`);
}