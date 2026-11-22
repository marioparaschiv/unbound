// `globalThis.__unboundRepl`: runs an entry as `$n`, answering with a bounded preview and its type.
// Each folded value comes with its path from `$n`, which `expand` previews in turn.
(() => {
	const DEPTH = 2;
	const ENTRIES = 40;
	const STRING = 160;
	const PREVIEW_BUDGET = 16000;
	// One `expand` answer stops previewing once it holds this much; the rest come on demand.
	const EXPAND_BUDGET = 64000;
	const TYPE_DEPTH = 2;
	const TYPE_MEMBERS = 50;
	const TYPE_BUDGET = 6000;
	const STACK_LINES = 12;
	const PLUMBING = /^\s*at eval \(native\)$|InternalBytecode\.js/;
	const NATIVE = /^\s*at \S+ \(native\)$/;
	// An eval'd frame's ` (:line:col)`, which counts in the JavaScript the console sent, not the entry.
	const EVAL_LOCATION = / \(:\d+:\d+\)$/;
	const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
	const PRIMITIVES = new Set(['string', 'number', 'boolean', 'bigint', 'symbol']);

	const key = (name) => (IDENTIFIER.test(name) ? name : JSON.stringify(name));

	function className(value) {
		try {
			const name = Object.getPrototypeOf(value)?.constructor?.name;

			return name && name !== 'Object' ? name : '';
		} catch {
			// A revoked proxy throws on reflection; it shows unnamed.
			return '';
		}
	}

	function ownKeys(value) {
		try {
			return Object.keys(value);
		} catch {
			// A host object can refuse enumeration; it shows empty.
			return [];
		}
	}

	function read(value, name) {
		try {
			return value[name];
		} catch {
			// A throwing getter shows as undefined rather than failing the whole preview.
			return undefined;
		}
	}

	// Methods a class instance inherits, such as a Flux store's getters.
	function methods(value) {
		const names = [];

		try {
			let proto = Object.getPrototypeOf(value);

			while (proto && proto !== Object.prototype && proto !== Array.prototype) {
				for (const name of Object.getOwnPropertyNames(proto)) {
					const descriptor = Object.getOwnPropertyDescriptor(proto, name);

					if (
						name !== 'constructor' &&
						!names.includes(name) &&
						typeof descriptor?.value === 'function'
					) {
						names.push(name);
					}
				}

				proto = Object.getPrototypeOf(proto);
			}
		} catch {
			// A proxy or host object can refuse reflection; it just shows no methods.
		}

		return names;
	}

	function leaf(value, seen) {
		const type = typeof value;

		if (value === null || type === 'undefined' || type === 'number' || type === 'boolean') {
			return String(value);
		}

		if (type === 'bigint') {
			return `${value}n`;
		}

		if (type === 'symbol') {
			return value.toString();
		}

		if (type === 'function') {
			return value.name ? `[Function ${value.name}]` : '[Function]';
		}

		if (value instanceof Error) {
			return `${value.name}: ${value.message}`;
		}

		if (value instanceof Date) {
			return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
		}

		if (value instanceof RegExp) {
			return String(value);
		}

		return seen.includes(value) ? '[Circular]' : undefined;
	}

	/**
	 * Entries to show, as `[label, value, separator, step]`, and how many there are in all.
	 * A step finds an entry from its parent: `{ k }` a key, `{ m }` the nth Map value, `{ s }` the nth Set item.
	 */
	function entriesOf(value) {
		const entries = [];

		if (Array.isArray(value)) {
			for (const [ix, item] of value.slice(0, ENTRIES).entries()) {
				entries.push(['', item, '', { k: String(ix) }]);
			}

			return { entries, total: value.length, head: '', brackets: '[]' };
		}

		if (value instanceof Map) {
			for (const [mapKey, item] of value) {
				if (entries.length >= ENTRIES) {
					break;
				}

				entries.push([
					typeof mapKey === 'string' ? JSON.stringify(mapKey) : String(mapKey),
					item,
					' => ',
					{ m: entries.length },
				]);
			}

			return { entries, total: value.size, head: `Map(${value.size}) `, brackets: '{}' };
		}

		if (value instanceof Set) {
			for (const item of value) {
				if (entries.length >= ENTRIES) {
					break;
				}

				entries.push(['', item, '', { s: entries.length }]);
			}

			return { entries, total: value.size, head: `Set(${value.size}) `, brackets: '[]' };
		}

		const keys = ownKeys(value);

		for (const name of keys.slice(0, ENTRIES))
			entries.push([key(name), read(value, name), ': ', { k: name }]);

		const name = className(value);

		return { entries, total: keys.length, head: name ? `${name} ` : '', brackets: '{}' };
	}

	// The entry a step names, read without running getters twice.
	function step(value, { k, m, s }) {
		if (k !== undefined) {
			return read(value, k);
		}

		const index = m ?? s;
		let at = 0;

		for (const item of m !== undefined ? value.values() : value) {
			if (at++ === index) {
				return item;
			}
		}

		return undefined;
	}

	// The preview, and each value it folded as `{ line, start, end, path }`: its line, its UTF-16
	// columns on that line, and the steps to it from the root.
	function preview(root) {
		let out = '';
		let truncated = false;
		let line = 0;
		let lineStart = 0;
		const seen = [];
		const folds = [];
		const path = [];

		function newline(text) {
			out += text;
			line++;
			lineStart = out.length;
		}

		function walk(value, depth, indent) {
			if (typeof value === 'string') {
				truncated ||= value.length > STRING;
				out += JSON.stringify(value.length > STRING ? `${value.slice(0, STRING)}…` : value);

				return;
			}

			const simple = leaf(value, seen);

			if (simple !== undefined) {
				out += simple;

				return;
			}

			const { entries, total, head, brackets } = entriesOf(value);
			const [open, close] = brackets;

			if (total === 0 || depth >= DEPTH) {
				truncated ||= total > 0;
				const start = out.length - lineStart;

				out += head + open + (total > 0 ? '…' : '') + close;

				if (total > 0) {
					folds.push({ line, start, end: out.length - lineStart, path: [...path] });
				}

				return;
			}

			seen.push(value);
			newline(`${head}${open}\n`);
			const inner = `${indent}  `;
			let shown = 0;

			for (; shown < entries.length && out.length < PREVIEW_BUDGET; shown++) {
				const [label, item, separator, at] = entries[shown];

				out += inner + label + separator;
				path.push(at);
				walk(item, depth + 1, inner);
				path.pop();
				newline(',\n');
			}

			if (shown < total) {
				truncated = true;
				newline(`${inner}… ${total - shown} more\n`);
			}

			out += indent + close;
			seen.pop();
		}

		walk(root, 0, '');

		return { text: out, truncated, folds };
	}

	function shape(root) {
		let budget = TYPE_BUDGET;
		const seen = [];

		function type(value, depth) {
			const kind = typeof value;

			if (budget <= 0) {
				return 'any';
			}

			if (value === null) {
				return 'null';
			}

			if (kind === 'undefined' || PRIMITIVES.has(kind)) {
				return kind;
			}

			if (kind === 'function') {
				return '(...args: any[]) => any';
			}

			if (value instanceof Date || value instanceof RegExp || value instanceof Error) {
				return value.constructor.name;
			}

			if (value instanceof Promise) {
				return 'Promise<any>';
			}

			if (value instanceof Map) {
				return 'Map<any, any>';
			}

			if (value instanceof Set) {
				return 'Set<any>';
			}

			if (Array.isArray(value)) {
				return value.length > 0 && depth < TYPE_DEPTH
					? `(${type(value[0], depth + 1)})[]`
					: 'any[]';
			}

			if (depth >= TYPE_DEPTH || seen.includes(value)) {
				return 'any';
			}

			seen.push(value);
			const members = [];
			const keys = ownKeys(value);

			for (const name of keys.slice(0, TYPE_MEMBERS)) {
				const member = `${key(name)}: ${type(read(value, name), depth + 1)}`;

				budget -= member.length;
				members.push(member);
			}

			if (keys.length > TYPE_MEMBERS) {
				members.push('[key: string]: any');
			}

			for (const name of methods(value).slice(0, TYPE_MEMBERS)) {
				members.push(`${key(name)}(...args: any[]): any`);
			}

			seen.pop();

			return members.length > 0 ? `{ ${members.join('; ')} }` : '{}';
		}

		return type(root, 0);
	}

	// The entry's own frames. Hermes marks the indirect-eval boundary `at eval (native)`, and an
	// async entry resumes in the bytecode's promise runtime; frames past either are this helper's.
	function entryFrames(lines) {
		const end = lines.findIndex((line) => PLUMBING.test(line));
		const kept = end === -1 ? lines : lines.slice(0, end);

		while (kept.length > 1 && NATIVE.test(kept.at(-1))) kept.pop();

		return kept.map((line) => line.replace(EVAL_LOCATION, ''));
	}

	// What a thrown value says: an error's stack, which on Hermes and V8 already starts with its
	// name and message, so they show once; anything else as its preview.
	function failure(thrown) {
		let text;

		if (thrown instanceof Error) {
			const head = `${thrown.name}: ${thrown.message}`;
			const stack = typeof thrown.stack === 'string' ? thrown.stack : '';
			const full = (stack.startsWith(head) ? stack : `${head}\n${stack}`).trim().split('\n');
			const lines = entryFrames(full);

			text = lines.slice(0, STACK_LINES).join('\n');

			if (lines.length > STACK_LINES) {
				text += `\n    … ${lines.length - STACK_LINES} more`;
			}
		} else {
			text = `Uncaught ${preview(thrown).text}`;
		}

		return JSON.stringify({ error: text });
	}

	function settle(n, value) {
		try {
			globalThis[`$${n}`] = value;
			const shown = preview(value);

			return JSON.stringify({
				text: shown.text,
				truncated: shown.truncated,
				folds: shown.folds,
				type: shape(value),
			});
		} catch (error) {
			return failure(error);
		}
	}

	// Previews the values at `paths` from `$n`, until the answer holds `EXPAND_BUDGET`; each one
	// after that answers `null`, to be asked for again when it opens.
	function expand(n, paths) {
		let budget = EXPAND_BUDGET;

		return JSON.stringify(
			paths.map((steps) => {
				if (budget <= 0) {
					return null;
				}

				try {
					const shown = preview(steps.reduce(step, globalThis[`$${n}`]));

					budget -= shown.text.length;

					return shown;
				} catch (error) {
					return { error: String(error) };
				}
			}),
		);
	}

	function run(n, source) {
		let value;

		try {
			// Indirect, so the entry runs in global scope and its `var`s outlive it.
			// oxlint-disable-next-line no-eval
			value = (0, eval)(source);
		} catch (error) {
			return failure(error);
		}

		if (typeof value?.then === 'function') {
			return value.then((resolved) => settle(n, resolved), failure);
		}

		return settle(n, value);
	}

	run.expand = expand;

	return run;
})();
