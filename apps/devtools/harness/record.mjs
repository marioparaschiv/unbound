// Recorder frontend: accepts one backend, logs every frame to JSONL, inspects a few elements.
// usage: bun record.mjs <out.jsonl> [port=8097]
import { WebSocketServer } from 'ws';
import { writeFileSync, appendFileSync } from 'node:fs';

const out = process.argv[2];
const port = Number(process.argv[3] ?? 8097);
writeFileSync(out, '');
const wss = new WebSocketServer({ port });
console.log('listening', port);

wss.on('connection', (ws) => {
	const log = (dir, frame) => appendFileSync(out, JSON.stringify({ dir, ...frame }) + '\n');
	const send = (event, payload) => {
		log('out', { event, payload });
		ws.send(JSON.stringify({ event, payload }));
	};
	const ids = [];
	let rid = 0;

	ws.on('message', (raw) => {
		const frame = JSON.parse(String(raw));
		log('in', frame);

		if (frame.event === 'operations') {
			const ops = frame.payload;
			let i = 2;
			const tableSize = ops[i++];
			i += tableSize;
			while (i < ops.length) {
				if (ops[i] === 1) ids.push(ops[i + 1]);
				break;
			}
		}
	});

	send('getBridgeProtocol', undefined);
	setTimeout(() => {
		for (const id of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]) {
			send('inspectElement', {
				forceFullData: true,
				id,
				path: null,
				rendererID: 1,
				requestID: ++rid,
			});
		}
		send('inspectElement', {
			forceFullData: false,
			id: 8,
			path: ['props', 'author', 'nested'],
			rendererID: 1,
			requestID: ++rid,
		});
		send('inspectElement', {
			forceFullData: false,
			id: 8,
			path: ['props', 'author'],
			rendererID: 1,
			requestID: ++rid,
		});
		send('updateComponentFilters', []);
	}, 500);
	setTimeout(() => {
		console.log('done');
		process.exit(0);
	}, 1500);
});
