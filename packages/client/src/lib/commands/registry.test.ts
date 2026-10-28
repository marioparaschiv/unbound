import { describe, expect, test } from 'bun:test';

import type { ErasedTree, Section } from './normalize';
import { CommandDefinitionError, normalize } from './normalize';
import { createRegistry } from './registry';

const shared: Section = { id: 'unbound', name: 'Unbound', icon: undefined };
const own: Section = { id: 'unbound:demo', name: 'Demo', icon: undefined };

function run() {
	return 'ok';
}

function leaves(...names: string[]): ErasedTree {
	return {
		tag: {
			description: 'Tags',
			subcommands: Object.fromEntries(
				names.map((name) => [name, { description: name, execute: run }]),
			),
		},
	};
}

function records(owner: string, tree: ErasedTree, section = shared) {
	return normalize({ owner, section, tree });
}

function listed(registry: ReturnType<typeof createRegistry>) {
	return registry
		.snapshot()
		.sections.map(({ section, commands }) => [
			section.id,
			commands.map((record) => record.path.join(' ')),
		]);
}

describe('registry', () => {
	test('lists registered commands under their sections', () => {
		const registry = createRegistry();

		registry.add(
			'unbound',
			records('unbound', { eval: { description: 'Eval', execute: run } }),
		);
		registry.add('demo', records('demo', leaves('add', 'remove'), own));

		expect(listed(registry)).toEqual([
			['unbound', ['eval']],
			['unbound:demo', ['tag add', 'tag remove']],
		]);
		expect([...registry.snapshot().sectionIds]).toEqual(['unbound', 'unbound:demo']);
	});

	test('re-registering a root replaces all of its old subcommands', () => {
		const registry = createRegistry();
		const removeOld = registry.add('demo', records('demo', leaves('add', 'remove')));

		registry.add('demo', records('demo', leaves('add')));
		expect(listed(registry)).toEqual([['unbound', ['tag add']]]);

		removeOld();
		expect(listed(registry)).toEqual([['unbound', ['tag add']]]);
	});

	test('a remover removes only its own call', () => {
		const registry = createRegistry();
		const removeTag = registry.add('demo', records('demo', leaves('add')));

		registry.add('demo', records('demo', { ping: { description: 'Ping', execute: run } }));
		removeTag();
		removeTag();

		expect(listed(registry)).toEqual([['unbound', ['ping']]]);
	});

	test('release removes an owner and is harmless twice', () => {
		const registry = createRegistry();
		const remove = registry.add('demo', records('demo', leaves('add')));

		registry.release('demo');
		const version = registry.snapshot().version;

		registry.release('demo');
		remove();

		expect(listed(registry)).toEqual([]);
		expect(registry.snapshot().version).toBe(version);
	});

	test('a root another owner has throws and changes nothing', () => {
		const registry = createRegistry();

		registry.add('first', records('first', leaves('add')));
		const before = registry.snapshot();

		expect(() =>
			registry.add('second', [
				...records('second', { ping: { description: 'Ping', execute: run } }),
				...records('second', leaves('remove')),
			]),
		).toThrow(CommandDefinitionError);
		expect(registry.snapshot()).toBe(before);
		expect(listed(registry)).toEqual([['unbound', ['tag add']]]);
	});

	test('notifies subscribers only on real changes', () => {
		const registry = createRegistry();
		let changes = 0;
		const unsubscribe = registry.subscribe(() => changes++);

		registry.add('demo', []);
		registry.release('nobody');
		expect(changes).toBe(0);

		registry.add('demo', records('demo', leaves('add')));
		registry.release('demo');
		expect(changes).toBe(2);

		unsubscribe();
		registry.add('demo', records('demo', leaves('add')));
		expect(changes).toBe(2);
	});
});
