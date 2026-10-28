import type { Plugin, PluginEntity } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { makeManifest, resetDevice } from './helpers/addons';

const { Plugins } = await import('~/managers/plugins');
const { createCommands } = await import('~/api/commands');
const { registry } = await import('~/lib/commands/registry');

type Behaviour = {
	startThrows?: boolean;
	stopThrows?: boolean;
};

class CommandPlugins extends Plugins {
	behaviour: Behaviour = {};

	protected handleBundle(_bundle: string, id: string): Plugin {
		const { startThrows, stopThrows } = this.behaviour;

		return {
			start: () => {
				// One root per plugin: the registry is shared, and a root another owner holds is refused.
				createCommands(id).register({
					[rootOf(id)]: { description: 'Ping', execute: () => 'pong' },
				});

				if (startThrows) {
					throw new Error('start failed');
				}
			},
			stop: () => {
				if (stopThrows) {
					throw new Error('stop failed');
				}
			},
		};
	}

	seed(id: string) {
		const entity: PluginEntity = {
			id,
			data: makeManifest(id),
			bundle: 'bundle',
			instance: null,
			started: false,
			failed: false,
		};

		this.entities.set(id, entity);
	}
}

function rootOf(id: string) {
	return id.replace('commands.', '');
}

function registered(owner: string) {
	return registry
		.snapshot()
		.sections.flatMap((view) => view.commands)
		.filter((record) => record.owner === owner)
		.map((record) => record.path.join(' '));
}

describe("a plugin's commands", () => {
	test.each([
		['stops', {}],
		['throws in stop', { stopThrows: true }],
	])('are removed when the plugin %s', async (name, behaviour) => {
		resetDevice();

		const plugins = new CommandPlugins();
		const id = `commands.${name.replaceAll(' ', '-')}`;

		plugins.behaviour = behaviour;
		plugins.seed(id);
		plugins.start(id);
		expect(registered(id)).toEqual([rootOf(id)]);

		await plugins.stop(id);
		expect(registered(id)).toEqual([]);
	});

	test('are removed when start throws after registering', () => {
		resetDevice();

		const plugins = new CommandPlugins();

		plugins.behaviour = { startThrows: true };
		plugins.seed('commands.failed-start');
		plugins.start('commands.failed-start');

		expect(registered('commands.failed-start')).toEqual([]);
	});
});
