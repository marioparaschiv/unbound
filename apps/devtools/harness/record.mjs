// usage: bun record.mjs <out.jsonl> [port=9090]
// Dials the bridge (or `device.mjs`) as the React DevTools frontend and records the session.
import WebSocket from 'ws';
import { writeFileSync, appendFileSync } from 'node:fs';

const out = process.argv[2];
const port = Number(process.argv[3] ?? 9090);
writeFileSync(out, '');
const ws = new WebSocket(`ws://127.0.0.1:${port}/?mcp`);

ws.on('open', () => {
	const log = (dir, frame) => appendFileSync(out, JSON.stringify({ dir, ...frame }) + '\n');
	const send = (event, payload) => {
		log('out', { event, payload });
		ws.send(JSON.stringify({ type: 'react-devtools', event, payload }));
	};
	const ids = [];
	let rid = 0;

	ws.on('message', (raw) => {
		const { type, ...frame } = JSON.parse(String(raw));
		if (type !== 'react-devtools') return;
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
