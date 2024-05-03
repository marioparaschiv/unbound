const BASE_PATH = './dist';
const PORT = Bun.argv[2];

const getCurrentDate = () => new Date().toTimeString().split(' ')[0];

Bun.serve({
	port: PORT,

	async fetch(req) {
		const filePath = BASE_PATH + new URL(req.url).pathname;
		const file = Bun.file(filePath);

		console.info(`\nYielding file:\n    File: ${filePath}\n    URL: ${req.url}\n    Time: ${getCurrentDate()}`);
		return new Response(file);
	},

	error() {
		return new Response(null, { status: 404 });
	},
});

console.log(`Listening to port ${PORT}. The time is ${getCurrentDate()}.`);