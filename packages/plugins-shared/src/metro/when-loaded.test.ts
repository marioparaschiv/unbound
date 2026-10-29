import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Module = { name: string };
type Filter = ((module: Module) => boolean) & { path?: string };
type Wait = { filter: Filter; onLoad: (module: Module) => void; stopped: boolean };

const loaded = new Map<Filter, Module>();
const waits: Wait[] = [];

function onModuleLoaded(filter: Filter, onLoad: (module: Module) => void) {
	const module = loaded.get(filter);

	if (module) {
		onLoad(module);

		return () => {};
	}

	const wait: Wait = { filter, onLoad, stopped: false };

	waits.push(wait);

	return () => {
		wait.stopped = true;
	};
}

function load(wait: Wait, module: Module) {
	if (!wait.stopped) {
		wait.onLoad(module);
	}
}

function byFilePath(path: string): Filter {
	return Object.assign(() => false, { path });
}

void mock.module('@unbound-app/api', () => ({
	metro: { onModuleLoaded, filters: { byFilePath } },
}));

const { whenAllLoaded, whenLoaded } = await import('./when-loaded');

function filter(): Filter {
	return () => false;
}

beforeEach(() => {
	loaded.clear();
	waits.length = 0;
});

describe('whenLoaded', () => {
	test('applies to a loaded module at once and removes the feature once on cleanup', () => {
		const source = filter();
		const events: string[] = [];

		loaded.set(source, { name: 'loaded' });

		const cleanup = whenLoaded<Module>(source, (module) => {
			events.push(`apply ${module.name}`);

			return () => events.push('remove');
		});

		expect(events).toEqual(['apply loaded']);

		cleanup();
		cleanup();

		expect(events).toEqual(['apply loaded', 'remove']);
	});

	test('applies once the module loads later', () => {
		const applied: string[] = [];

		whenLoaded<Module>(filter(), (module) => void applied.push(module.name));

		expect(applied).toEqual([]);

		load(waits[0], { name: 'late' });

		expect(applied).toEqual(['late']);
	});

	test('waits on a file path through its file path filter', () => {
		whenLoaded<Module>('modules/chat/native/TypingIndicator.tsx', () => undefined);

		expect(waits[0].filter.path).toBe('modules/chat/native/TypingIndicator.tsx');
	});

	test('never applies after cleanup and stops the wait', () => {
		let applied = false;
		const cleanup = whenLoaded<Module>(filter(), () => void (applied = true));

		cleanup();
		load(waits[0], { name: 'late' });

		expect(waits[0].stopped).toBe(true);
		expect(applied).toBe(false);
	});

	test('prefers the first loaded source, otherwise the first source to load', () => {
		const [first, second, third] = [filter(), filter(), filter()];
		const applied: string[] = [];

		loaded.set(third, { name: 'third' });
		whenLoaded<Module>([first, second, third], (module) => void applied.push(module.name));

		expect(applied).toEqual(['third']);
		expect(waits.every((wait) => wait.stopped)).toBe(true);

		waits.length = 0;
		whenLoaded<Module>([first, second], (module) => void applied.push(module.name));
		load(waits[1], { name: 'second' });
		load(waits[0], { name: 'first' });

		expect(applied).toEqual(['third', 'second']);
		expect(waits[0].stopped).toBe(true);
	});
});

describe('whenAllLoaded', () => {
	test('applies once every module has loaded and removes the feature on cleanup', () => {
		const [first, second] = [filter(), filter()];
		const events: string[] = [];

		loaded.set(first, { name: 'first' });

		const cleanup = whenAllLoaded([first, second], () => {
			events.push('apply');

			return () => events.push('remove');
		});

		expect(events).toEqual([]);

		load(waits[0], { name: 'second' });
		cleanup();

		expect(events).toEqual(['apply', 'remove']);
	});

	test('never applies when cleaned up while waiting', () => {
		let applied = false;
		const cleanup = whenAllLoaded([filter()], () => void (applied = true));

		cleanup();
		load(waits[0], { name: 'late' });

		expect(applied).toBe(false);
	});
});
