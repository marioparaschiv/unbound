// The device side of the Console page: `eval` frames run here as the client's `handleEvalRequest`
// runs them, against a small stand-in for Unbound's global and a Discord-sized Flux store.

class User {
	constructor(id, username) {
		this.id = id;
		this.username = username;
		this.globalName = username[0].toUpperCase() + username.slice(1);
		this.avatar = `a_${id.slice(-8)}`;
		this.bot = false;
	}

	getAvatarURL() {
		return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.png`;
	}
}

class UserStore {
	constructor() {
		this._currentUserId = '1180234455667788990';
		this._users = new Map();

		for (let i = 0; i < 3021; i++) {
			const id = String(1180234455667788990n + BigInt(i));
			this._users.set(id, new User(id, i === 0 ? 'mario' : `user${i}`));
		}
	}

	getCurrentUser() {
		return this._users.get(this._currentUserId);
	}

	getUser(id) {
		return this._users.get(id);
	}

	getUsers() {
		return Object.fromEntries(this._users);
	}
}

const stores = { UserStore: new UserStore() };

// Mirrors `getStore` in packages/client/src/flux/api.ts: `short` appends `Store`, and a miss is an
// empty lazy proxy rather than undefined.
globalThis.unbound = {
	flux: {
		getStore: (name, { short = true } = {}) => stores[short ? `${name}Store` : name] ?? {},
	},
	metro: { findByProps: () => undefined },
	toasts: { showToast: (content) => ({ content }) },
};

// Mirrors `inspect` in packages/client/src/debugger/builtin.dev.ts.
function inspect(value) {
	if (value instanceof Error)
		return `${value.name}: ${value.message}\n${value.stack ?? ''}`.trim();

	if (typeof value === 'string') return value;

	if (value === undefined) return 'undefined';

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return Object.prototype.toString.call(value);
	}
}

export async function answerEval(frame) {
	try {
		// oxlint-disable-next-line no-eval
		const value = await (0, eval)(frame.code);

		return { type: 'eval-result', id: frame.id, ok: true, value: inspect(value) };
	} catch (error) {
		return { type: 'eval-result', id: frame.id, ok: false, error: inspect(error) };
	}
}
