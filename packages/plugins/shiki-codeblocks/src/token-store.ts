import type { ThemedToken } from 'shiki';
import { fs } from '@unbound-app/api';

type TokenLines = ThemedToken[][];

export type TokenFiles = {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, contents: string): Promise<unknown>;
};

export type TokenStore = {
	ready: Promise<void>;
	get(key: string): TokenLines | undefined;
	set(key: string, tokens: TokenLines): void;
	flush(): Promise<void>;
};

export const TOKEN_STORE_PATH = 'Unbound/cache/shiki-codeblocks/tokens-v1.json';
const STORED_ENTRIES = 48;
const STORED_CODE_LENGTH = 4_000;
const WRITE_DELAY_MS = 2_000;

function compact(tokens: TokenLines): TokenLines {
	return tokens.map((line) =>
		line.map(({ content, offset, color, fontStyle }) => ({
			content,
			offset,
			color,
			fontStyle,
		})),
	);
}

/**
 * @description Keeps recent highlighting results in a file, so cards that were highlighted before a restart draw at once instead of waiting for Shiki to start.
 * @param files Where the results are read from and written to.
 * @param path The file holding them.
 * @returns The store; `ready` settles once the saved results are loaded, and `set` saves a result shortly after.
 */
export function createTokenStore(files: TokenFiles, path = TOKEN_STORE_PATH): TokenStore {
	const entries = new Map<string, TokenLines>();
	let timer: ReturnType<typeof setTimeout> | null = null;

	const ready = (async () => {
		try {
			if (!(await files.exists(path))) return;

			const saved = JSON.parse(await files.read(path)) as [string, TokenLines][];

			for (const [key, tokens] of saved.slice(-STORED_ENTRIES)) entries.set(key, tokens);
		} catch {
			entries.clear();
		}
	})();

	async function flush() {
		if (timer) clearTimeout(timer);

		timer = null;
		await files.write(path, JSON.stringify([...entries])).catch(() => undefined);
	}

	return {
		ready,
		get: (key) => entries.get(key),
		set(key, tokens) {
			if (key.length > STORED_CODE_LENGTH) return;

			entries.delete(key);
			entries.set(key, compact(tokens));

			while (entries.size > STORED_ENTRIES) entries.delete(entries.keys().next().value!);

			timer ??= setTimeout(() => void flush(), WRITE_DELAY_MS);
		},
		flush,
	};
}

let shared: TokenStore | null | undefined;

/**
 * @description Returns the token store every highlighter in the plugin shares, created on first use.
 * @returns The store, or `undefined` where no file API is available.
 */
export function sharedTokenStore(): TokenStore | undefined {
	if (shared === undefined) {
		shared = typeof fs?.read === 'function' ? createTokenStore(fs as TokenFiles) : null;
	}

	return shared ?? undefined;
}

export default { createTokenStore, sharedTokenStore };
