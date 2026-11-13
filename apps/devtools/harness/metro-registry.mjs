// A fake Metro registry for `metro.mjs`, shaped after metro-runtime's require.js and Discord's Hermes bundle:
// a Map of ids with gaps; a loaded record drops factory and dependencyMap, an errored one clears its exports.
// The exports cover ES modules, re-export getters, transpiled classes, Flux stores linked back to their
// dispatcher, enums, a throwing getter, a proxy that throws on ownKeys, a 1,500-key export and a cycle.

const EMPTY = {};
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const AREAS = [
	'user_profile',
	'guild_settings',
	'messages',
	'voice',
	'quests',
	'premium',
	'channel_list',
	'emojis',
	'friends',
	'notifications',
	'activities',
	'app_launcher',
];
const KINDS = [
	'native/{N}.tsx',
	'native/{N}Store.tsx',
	'web/{N}Utils.tsx',
	'native/components/{N}Row.tsx',
	'{N}Constants.tsx',
	'native/{N}ActionCreators.tsx',
];
const NAMES = [
	'UserProfile',
	'GuildBoost',
	'MessageContent',
	'VoicePanel',
	'QuestCard',
	'PremiumGift',
	'ChannelRow',
	'EmojiPicker',
	'FriendRequest',
	'Inbox',
	'ActivityShelf',
	'AppLauncher',
];
function ReactComponent(props) {
	this.props = props;
	this.state = null;
}
ReactComponent.prototype.isReactComponent = {};
ReactComponent.prototype.setState = function setState() {};
ReactComponent.prototype.forceUpdate = function forceUpdate() {};
function transpiledClass(name, base, methods) {
	const C = {
		[name]: function (props) {
			base.call(this, props);
		},
	}[name];
	C.prototype = Object.create(base.prototype, {
		constructor: { value: C, writable: true, configurable: true },
	});
	for (const m of methods) C.prototype[m] = { [m]() {} }[m];
	Object.setPrototypeOf(C, base);
	C.displayName = name;
	return C;
}
const Dispatcher = {
	_stores: [],
	_actionHandlers: new Map(),
	_interceptor: null,
	dispatch() {},
	subscribe() {},
};
function Store() {}
Store.prototype.initialize = function initialize() {};
Store.prototype.emitChange = function emitChange() {};
Store.prototype.addChangeListener = function addChangeListener() {};
Store.prototype.getName = function getName() {
	return this.constructor.displayName;
};
function storeInstance(name) {
	const C = transpiledClass(name, Store, [
		'getState',
		'getCurrentUser',
		'getUser',
		'__getLocalVars',
	]);
	const s = new C();
	s._dispatcher = Dispatcher;
	s._isInitialized = true;
	s._changeCallbacks = new Set([function onChange() {}]);
	s._users = Object.fromEntries(
		Array.from({ length: 140 }, (_, i) => [
			String(100000000000000000 + i * 7919),
			{
				id: String(100000000000000000 + i * 7919),
				username: `user${i}`,
				discriminator: '0',
				bot: i % 9 === 0,
			},
		]),
	);
	Dispatcher._stores.push(s);
	Dispatcher._actionHandlers.set(`${name.toUpperCase()}_UPDATE`, function handler() {});
	return s;
}
const shapes = [
	(_, n) => ({
		__esModule: true,
		default: transpiledClass(n, ReactComponent, [
			'render',
			'componentDidMount',
			'componentWillUnmount',
		]),
	}),
	(_, n) => {
		const fn = {
			[n]: function () {
				return null;
			},
		}[n];
		return {
			__esModule: true,
			default: { $$typeof: Symbol.for('react.memo'), type: fn, compare: null },
		};
	},
	(_, n) => ({ __esModule: true, default: storeInstance(`${n}Store`) }),
	(id) => {
		const exports = { __esModule: true };
		for (const k of [
			'useStateFromStores',
			'useStateFromStoresArray',
			'statesWillNeverBeEqual',
		]) {
			Object.defineProperty(exports, k, { enumerable: true, get: () => function hook() {} });
		}
		Object.defineProperty(exports, 'LazyModule', {
			enumerable: true,
			get: () => {
				const target = id + 1;
				return window.modules.get(target)?.publicModule.exports;
			},
		});
		return exports;
	},
	(_, n) =>
		Object.assign(
			function interopRequireDefault(obj) {
				return obj && obj.__esModule ? obj : { default: obj };
			},
			{ displayName: n, __esModule: false },
		),
	() =>
		Object.freeze({
			0: 'IDLE',
			1: 'CONNECTING',
			2: 'CONNECTED',
			IDLE: 0,
			CONNECTING: 1,
			CONNECTED: 2,
		}),
	(_, n) => ({
		__esModule: true,
		[`${n.toUpperCase()}_MAX`]: 25,
		Endpoints: { USER: (id) => `/users/${id}`, GUILDS: '/guilds' },
		colors: new Map([
			['brand', '#5865f2'],
			['danger', '#f23f43'],
		]),
	}),
	() => ({}),
];
const hostile = [
	() => {
		const e = {
			__esModule: true,
			[Symbol.for('react.element')]: true,
			[Symbol('internal')]: 1,
		};
		Object.defineProperty(e, 'broken', {
			enumerable: true,
			get() {
				throw new TypeError("Cannot read property 'id' of undefined");
			},
		});
		return e;
	},
	() =>
		new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('HostObject cannot be enumerated');
				},
				get: () => () => {
					return;
				},
			},
		),
	() => ({
		__esModule: true,
		default: Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [`Icon${i}`, 4000 + i])),
	}),
	() => {
		const a = { name: 'ChannelRecord', guild: null };
		const b = { name: 'GuildRecord', channels: [a] };
		a.guild = b;
		return { __esModule: true, default: a };
	},
];
const modules = new Map();
const TOTAL = 1400;
function makeExports(id, name) {
	if (id % 97 === 13) return hostile[((id / 97) | 0) % hostile.length]();
	return shapes[id % shapes.length](id, name);
}
function pathFor(name) {
	return `modules/${pick(AREAS)}/${pick(KINDS).replace('{N}', name)}`;
}
for (let id = 0; id < TOTAL; id++) {
	if (rand() < 0.02) continue;
	const name = `${pick(NAMES)}${id}`;
	const roll = rand();
	const deps = Array.from({ length: Math.floor(rand() * 4) }, () => Math.floor(rand() * TOTAL));
	const filePath = rand() < 0.55 ? pathFor(name) : undefined;
	if (roll < 0.36 || id % 97 === 13) {
		modules.set(id, {
			factory: undefined,
			dependencyMap: undefined,
			isInitialized: true,
			hasError: false,
			importedAll: EMPTY,
			importedDefault: EMPTY,
			publicModule: { id, exports: makeExports(id, name) },
			__filePath: filePath,
		});
	} else if (roll < 0.39) {
		modules.set(id, {
			factory: undefined,
			dependencyMap: deps,
			isInitialized: false,
			hasError: true,
			error: new Error('Requiring unknown module'),
			importedAll: EMPTY,
			importedDefault: EMPTY,
			publicModule: { exports: undefined },
		});
	} else {
		const throws = rand() < 0.08;
		modules.set(id, {
			factory: (_g, require, _d, _a, module) => {
				for (const dep of deps) if (modules.has(dep)) require(dep);
				if (throws)
					throw new Error(`Invariant Violation: ${name} requires a native module`);
				module.exports = makeExports(id, name);
			},
			dependencyMap: deps,
			isInitialized: false,
			hasError: false,
			importedAll: EMPTY,
			importedDefault: EMPTY,
			publicModule: { exports: {} },
			__fileHint: filePath,
		});
	}
}
function metroRequire(id) {
	const rec = modules.get(id);
	if (!rec) throw new Error(`Requiring unknown module "${id}".`);
	if (rec.isInitialized) return rec.publicModule.exports;
	if (rec.hasError) throw rec.error;
	rec.isInitialized = true;
	try {
		rec.factory(
			globalThis,
			metroRequire,
			metroRequire,
			metroRequire,
			rec.publicModule,
			rec.publicModule.exports,
			rec.dependencyMap,
		);
		rec.factory = undefined;
		rec.dependencyMap = undefined;
		rec.__filePath = rec.__fileHint;
		return rec.publicModule.exports;
	} catch (error) {
		rec.hasError = true;
		rec.error = error;
		rec.isInitialized = false;
		rec.publicModule.exports = undefined;
		throw error;
	}
}
globalThis.modules = modules;
globalThis.window = globalThis;
globalThis.__r = metroRequire;
