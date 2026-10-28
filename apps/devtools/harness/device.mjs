// usage: [DEPTH=n] [WIDTH=n] [TICK_MS=n] bun device.mjs [port=8097] [host=127.0.0.1]
// DEPTH nests the app n components deep (function, memo, host View in turn) and WIDTH adds n sibling
// rows at the bottom, to mimic Discord-scale trees.
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
window.DevTools.connect({ host, port });

if (process.env.TICK_MS) {
	setInterval(() => root.update(render(++tick % 5)), Number(process.env.TICK_MS));
}

console.log(`device up, dialing ws://${host}:${port}`);
