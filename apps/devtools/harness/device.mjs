// usage: [DEPTH=n] [WIDTH=n] [TICK_MS=n] bun device.mjs [port=9090]
// A debugger bridge with a device already attached: controllers dial ws://127.0.0.1:<port>/?mcp and
// get React DevTools over `react-devtools` frames, as Unbound's client and bridge carry them.
// DEPTH nests the app n components deep (function, memo, host View in turn) and WIDTH adds n sibling
// rows at the bottom, to mimic Discord-scale trees.
import { createRequire } from 'node:module';
import { WebSocketServer } from 'ws';

const port = Number(process.argv[2] ?? 9090);
const require = createRequire(import.meta.url);

globalThis.window = globalThis;
// The same backend the client build ships as `devtools.<bytecode>.bundle`, set up the way its entry does.
const backend = require('react-devtools-core/dist/backend.js');
backend.initialize();

const React = require('react');
const TestRenderer = require('react-test-renderer');
const h = React.createElement;

const ThemeContext = React.createContext('dark');

class Counter extends React.Component {
	state = { count: 1, label: 'clicks' };
	render() {
		return h('Text', { style: { color: 'red' } }, `${this.state.label}: ${this.state.count}`);
	}
}

function MessageRow({ message, author }) {
	const [hovered, setHovered] = React.useState(false);
	const theme = React.useContext(ThemeContext);
	const ref = React.useRef(null);
	React.useEffect(() => {}, []);

	return h(
		'View',
		{ ref, accessibilityLabel: message.content, theme, hovered },
		h('Text', null, `${author.username}: ${message.content}`),
	);
}

const MemoRow = React.memo(MessageRow);
const ForwardedInput = React.forwardRef(function ChatInput(props, ref) {
	return h('TextInput', { ref, placeholder: props.placeholder });
});

function Channel({ messages }) {
	return h(
		'ScrollView',
		null,
		messages.map((m) => h(MemoRow, { key: m.id, message: m, author: m.author })),
	);
}

function App({ tick }) {
	return h(
		ThemeContext.Provider,
		{ value: 'dark' },
		h(Counter),
		h(Channel, {
			messages: Array.from({ length: 3 + tick }, (_, i) => ({
				id: `m${i}`,
				content: `hello ${i}`,
				author: {
					id: `u${i}`,
					username: `user${i}`,
					nested: { deep: { deeper: [1, 2, 3] } },
				},
			})),
		}),
		h(ForwardedInput, { placeholder: 'Message #general' }),
	);
}

const depth = Number(process.env.DEPTH ?? 0);
const width = Number(process.env.WIDTH ?? 0);

function Shell({ children }) {
	return children;
}

const Pane = React.memo(function Pane({ children }) {
	return children;
});

function Row({ index }) {
	return h('Text', null, `row ${index}`);
}

function Rows({ count }) {
	return Array.from({ length: count }, (_, i) => h(Row, { key: `r${i}`, index: i }));
}

function render(tick) {
	let tree = h(App, { tick });

	if (width > 0) {
		tree = h(React.Fragment, null, tree, h(Rows, { count: width }));
	}

	for (let level = depth - 1; level >= 0; level--) {
		tree = h([Shell, Pane, 'View'][level % 3], null, tree);
	}

	return tree;
}

let tick = 0;
const root = TestRenderer.create(render(tick));

if (process.env.TICK_MS) {
	setInterval(() => root.update(render(++tick % 5)), Number(process.env.TICK_MS));
}

// The device side, as `react-devtools.dev.ts` runs it: a session starts on the frontend's first frame
// and ends on `shutdown`.
let session = null;
let frontend = null;

function toFrontend(event, payload) {
	frontend?.send(JSON.stringify({ type: 'react-devtools', event, payload }));
}

function receive(frame) {
	if (frame.event === 'shutdown') {
		endSession();
		return;
	}

	if (!session) {
		const listeners = new Set();
		session = { listeners, unsubscribe: null };
		session.unsubscribe = backend.connectWithCustomMessagingProtocol({
			onSubscribe: (listener) => listeners.add(listener),
			onUnsubscribe: (listener) => listeners.delete(listener),
			onMessage: toFrontend,
		});
		toFrontend('unbound:backend-status', { connected: true });
	}

	for (const listener of session.listeners)
		listener({ event: frame.event, payload: frame.payload });
}

function endSession() {
	if (!session) return;

	const { listeners, unsubscribe } = session;
	session = null;

	for (const listener of listeners) listener({ event: 'shutdown' });

	unsubscribe?.();
}

const device = {
	platform: 'android',
	discordVersion: '300.0',
	loaderVersion: '1.0.0',
	clientVersion: '2.0.0',
};
const server = new WebSocketServer({ host: '127.0.0.1', port });

server.on('connection', (socket) => {
	socket.send(JSON.stringify({ type: 'device-status', connected: true, device }));

	socket.on('message', (raw) => {
		const frame = JSON.parse(String(raw));

		if (frame.type === 'react-devtools') {
			frontend = socket;
			receive(frame);
		}
	});

	socket.on('close', () => {
		if (frontend !== socket) return;

		frontend = null;
		endSession();
	});
});

console.log(`device up, bridge on ws://127.0.0.1:${port}`);
