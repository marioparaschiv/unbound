// Fake device: runs Unbound's real devtools.js backend against react-test-renderer and dials a frontend.
// usage: bun device.mjs [port=8097] [host=127.0.0.1]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import WebSocket from 'ws';

const port = Number(process.argv[2] ?? 8097);
const host = process.argv[3] ?? '127.0.0.1';
const require = createRequire(import.meta.url);

globalThis.window = globalThis;
globalThis.WebSocket = WebSocket;
const src = readFileSync(
	new URL('../../../packages/loader/bootstrap/devtools.js', import.meta.url),
	'utf8',
);
new Function(src).call(globalThis);

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

let tick = 0;
const root = TestRenderer.create(h(App, { tick }));
window.DevTools.connect({ host, port });

if (process.env.TICK_MS) {
	setInterval(() => root.update(h(App, { tick: ++tick % 5 })), Number(process.env.TICK_MS));
}

console.log(`device up, dialing ws://${host}:${port}`);
