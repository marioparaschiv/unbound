import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Module = { name: string };
type Filter = ((module: Module) => boolean) & { path?: string };
type Wait = { filter: Filter; signal: AbortSignal; resolve: (module?: Module) => void };

const loaded = new Map<Filter, Module>();
const waits: Wait[] = [];

function findLazy(filter: Filter, { signal }: { signal: AbortSignal }) {
	const module = loaded.get(filter);

	if (module) {
		return module;
	}

	return new Promise<Module | undefined>((resolve) => {
		waits.push({ filter, signal, resolve });
		signal.addEventListener('abort', () => resolve(undefined));
	});
}

function byFilePath(path: string): Filter {
	return Object.assign(() => false, { path });
}

void mock.module('@unbound-app/api', () => ({ metro: { findLazy, filters: { byFilePath } } }));

const { whenAllLoaded, whenLoaded } = await import('./when-loaded');

function filter(): Filter {
	return () => false;
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	loaded.clear();
	waits.length = 0;
});

describe('whenLoaded', () => {
	test('applies to a loaded module and removes the feature once on cleanup', async () => {
		const source = filter();
		const events: string[] = [];

		loaded.set(source, { name: 'loaded' });

		const cleanup = whenLoaded<Module>(source, (module) => {
			events.push(`apply ${module.name}`);

			return () => events.push('remove');
		});

		await flush();
		cleanup();
		cleanup();

		expect(events).toEqual(['apply loaded', 'remove']);
	});

	test('applies once the module loads later', async () => {
		const applied: string[] = [];

		whenLoaded<Module>(filter(), (module) => void applied.push(module.name));
		await flush();

		expect(applied).toEqual([]);

		waits[0].resolve({ name: 'late' });
		await flush();

		expect(applied).toEqual(['late']);
	});

	test('waits on a file path through its file path filter', () => {
		whenLoaded<Module>('modules/chat/native/TypingIndicator.tsx', () => undefined);

		expect(waits[0].filter.path).toBe('modules/chat/native/TypingIndicator.tsx');
	});

	test('never applies after cleanup and abandons the wait', async () => {
		let applied = false;
		const cleanup = whenLoaded<Module>(filter(), () => void (applied = true));

		cleanup();
		waits[0].resolve({ name: 'late' });
		await flush();

		expect(waits[0].signal.aborted).toBe(true);
		expect(applied).toBe(false);
	});

	test('does not apply to a loaded module when cleaned up in the same tick', async () => {
		const source = filter();
		let applied = false;

		loaded.set(source, { name: 'loaded' });
		whenLoaded<Module>(source, () => void (applied = true))();
		await flush();

		expect(applied).toBe(false);
	});

	test('prefers the first loaded source, otherwise the first source to load', async () => {
		const [first, second, third] = [filter(), filter(), filter()];
		const applied: string[] = [];

		loaded.set(third, { name: 'third' });
		whenLoaded<Module>([first, second, third], (module) => void applied.push(module.name));
		await flush();

		expect(applied).toEqual(['third']);
		expect(waits.every((wait) => wait.signal.aborted)).toBe(true);

		waits.length = 0;
		whenLoaded<Module>([first, second], (module) => void applied.push(module.name));
		waits[1].resolve({ name: 'second' });
		await flush();

		expect(applied).toEqual(['third', 'second']);
		expect(waits[0].signal.aborted).toBe(true);
	});
});

describe('whenAllLoaded', () => {
	test('applies once every module has loaded and removes the feature on cleanup', async () => {
		const [first, second] = [filter(), filter()];
		const events: string[] = [];

		loaded.set(first, { name: 'first' });

		const cleanup = whenAllLoaded([first, second], () => {
			events.push('apply');

			return () => events.push('remove');
		});

		await flush();

		expect(events).toEqual([]);

		waits[0].resolve({ name: 'second' });
		await flush();
		cleanup();

		expect(events).toEqual(['apply', 'remove']);
	});

	test('never applies when cleaned up while waiting', async () => {
		let applied = false;
		const cleanup = whenAllLoaded([filter()], () => void (applied = true));

		cleanup();
		waits[0].resolve({ name: 'late' });
		await flush();

		expect(applied).toBe(false);
	});
});
