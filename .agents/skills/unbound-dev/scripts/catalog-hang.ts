// Accepts connections on the catalog port and never answers, to hold the client in its loading state.
const PORT = Number(process.env.PORT ?? 3200);

Bun.listen({
	hostname: '0.0.0.0',
	port: PORT,
	socket: {
		data() {},
		open() {
			console.log('connection held');
		},
	},
});
console.log(`hanging on ${PORT}`);
