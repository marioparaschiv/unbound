import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as React from 'react';

import type { SettingsButtonState } from '~/ui/addons/settings-button-state';

import { makeManifest, resetDevice, states } from './helpers/addons';

Object.assign(globalThis, { window: globalThis, modules: new Map(), $$DEV$$: false });

const { Plugins } = await import('~/plugins/manager');
const { settingsButtonState } = await import('~/ui/addons/settings-button-state');

const ID = 'entry.example';
const LOG = '__pluginEntryLog';
const EVALS = '__pluginEntryEvaluations';

/**
 * Wraps a module body the way the CLI's entrypoint (`packages/cli/src/rollup/entrypoint.ts`) does: the IIFE
 * returns the entry's named exports, and `__load` runs it once.
 */
function bundle(exports: string): string {
	const module = `function(){"use strict";const log=globalThis.${LOG};globalThis.${EVALS}=(globalThis.${EVALS}??0)+1;return{${exports}}}()`;

	return `({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=${module};return this.__plugin;}})`;
}

function log(): string[] {
	return Reflect.get(globalThis, LOG);
}

/** Wraps a body the way `ubd` built entries before named exports: the module's `default` is the plugin object. */
function legacyBundle(members: string): string {
	const module = `function(){"use strict";const log=globalThis.${LOG};return{default:{${members}}}}()`;

	return `({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=${module};return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);}})`;
}

function startLegacy(members: string) {
	const plugins = new Plugins();

	states[ID] = true;
	plugins.load(legacyBundle(members), makeManifest(ID));

	return plugins;
}

/** A legacy entry whose default object was its only export: the older ubd's IIFE returned the object itself. */
function startFlatLegacy(members: string) {
	return startEntry(members);
}

function startEntry(exports: string) {
	const plugins = new Plugins();

	states[ID] = true;
	plugins.load(bundle(exports), makeManifest(ID));

	return plugins;
}

beforeEach(() => {
	resetDevice();
	Reflect.set(globalThis, 'window', globalThis);
	Reflect.set(globalThis, 'React', React);
	Reflect.set(globalThis, LOG, []);
});

afterEach(() => {
	Reflect.deleteProperty(globalThis, LOG);
	Reflect.deleteProperty(globalThis, EVALS);
	Reflect.deleteProperty(globalThis, 'React');
	Reflect.deleteProperty(globalThis, 'window');
});

describe('plugin entry named exports', () => {
	test('runs the exported start with the context, and stop', async () => {
		const plugins = startEntry(
			'start(context){log.push("start:"+typeof context.dispose)},stop(){log.push("stop")}',
		);

		expect(plugins.getEntity(ID)?.started).toBe(true);

		await plugins.stop(ID);

		expect(log()).toEqual(['start:function', 'stop']);
		expect(plugins.getEntity(ID)?.started).toBe(false);
	});

	test('starts a plugin that exports no start and no stop', async () => {
		const plugins = startEntry('');

		expect(plugins.getEntity(ID)?.started).toBe(true);
		expect(plugins.errors.get(ID)).toBeUndefined();

		await plugins.stop(ID);

		expect(plugins.errors.get(ID)).toBeUndefined();
	});

	test('awaits an async stop before it reports the plugin stopped', async () => {
		const plugins = startEntry('async stop(){await null;log.push("stopped")}');
		const stopped: string[] = [];

		plugins.on('stopped', () => stopped.push(log().join()));
		await plugins.stop(ID);

		expect(stopped).toEqual(['stopped']);
	});

	test('records a rejected async start as a start failure', async () => {
		const plugins = startEntry('async start(){await null;throw new Error("late")}');

		await Promise.resolve();
		await Promise.resolve();

		expect(plugins.errors.get(ID)?.message).toBe('late');
		expect(plugins.getEntity(ID)?.failed).toBe(true);
	});

	test('evaluates the module afresh on each start', async () => {
		const plugins = startEntry('start(){log.push("start")}');

		await plugins.stop(ID);
		plugins.start(ID);

		expect(log()).toEqual(['start', 'start']);
		expect(Reflect.get(globalThis, EVALS)).toBe(2);
	});

	test('reads a legacy default-object bundle: start and stop on the object, getSettingsPanel as SettingsPanel', async () => {
		const plugins = startLegacy(
			'start(){log.push("start:"+this.name)},stop(){log.push("stop")},getSettingsPanel(){return "legacy-panel"},name:"old"',
		);
		const addon = plugins.getEntity(ID)!;
		const Panel = addon.SettingsPanel as () => string;

		expect(addon.started).toBe(true);
		expect(Panel()).toBe('legacy-panel');

		await plugins.stop(ID);

		expect(log()).toEqual(['start:old', 'stop']);
	});

	test('reads a legacy bundle whose IIFE returned the default object: getSettingsPanel as SettingsPanel', () => {
		const plugins = startFlatLegacy(
			'start(){},getSettingsPanel(){return "legacy-panel:"+this.name},name:"old"',
		);
		const Panel = plugins.getEntity(ID)!.SettingsPanel as () => string;

		expect(Panel()).toBe('legacy-panel:old');
	});
});

type Phase = { phase: string; button: SettingsButtonState; opens: boolean };

function phaseOf(plugins: InstanceType<typeof Plugins>): Phase {
	const addon = plugins.getEntity(ID)!;

	return {
		phase: addon.phase,
		button: settingsButtonState(addon.phase, addon.hasSettingsPanel),
		opens: Boolean(addon.SettingsPanel),
	};
}

const SHOWN = { visible: true, enabled: true };
const HIDDEN = { visible: false, enabled: false };
const DISABLED = { visible: true, enabled: false };

// Each bundle shape the loader reads: named exports, and a legacy default object built by an older ubd.
const SHAPES = [
	{ name: 'named exports', start: startEntry, panel: 'SettingsPanel(){return "panel"}' },
	{
		name: 'a legacy default object',
		start: startLegacy,
		panel: 'getSettingsPanel(){return "panel"}',
	},
	{
		name: 'a legacy object the IIFE returned',
		start: startFlatLegacy,
		panel: 'getSettingsPanel(){return "panel"}',
	},
];

describe.each(SHAPES)('the settings button over $name', ({ start, panel }) => {
	test('shows and opens while the plugin runs with a panel, and is hidden once it stops', async () => {
		const plugins = start(`start(){},${panel}`);
		const changes: string[] = [];

		plugins.on('changed', (entity) => changes.push(entity.phase));

		expect(phaseOf(plugins)).toEqual({ phase: 'running', button: SHOWN, opens: true });

		await plugins.stop(ID);

		expect(phaseOf(plugins)).toEqual({ phase: 'stopped', button: HIDDEN, opens: false });
		expect(changes).toEqual(['stopped']);

		plugins.start(ID);

		expect(phaseOf(plugins)).toEqual({ phase: 'running', button: SHOWN, opens: true });
		expect(changes).toEqual(['stopped', 'running']);
	});

	test('is hidden while the plugin runs without a panel', () => {
		expect(phaseOf(start('start(){}'))).toEqual({
			phase: 'running',
			button: HIDDEN,
			opens: false,
		});
	});

	test('is disabled, and never opens, after the start failed', () => {
		const plugins = start(`start(){throw new Error("boom")},${panel}`);

		expect(phaseOf(plugins)).toEqual({ phase: 'failed', button: DISABLED, opens: false });
	});

	test('is disabled while an async start is in flight, and opens once it settles', async () => {
		const plugins = start(`async start(){await null},${panel}`);

		expect(phaseOf(plugins)).toEqual({ phase: 'starting', button: DISABLED, opens: false });

		await Promise.resolve();
		await Promise.resolve();

		expect(phaseOf(plugins)).toEqual({ phase: 'running', button: SHOWN, opens: true });
	});

	test('leaves as soon as an async stop begins, and stays hidden once it settles', async () => {
		const plugins = start(`start(){},async stop(){await null},${panel}`);
		const stopping = plugins.stop(ID);

		expect(phaseOf(plugins)).toEqual({ phase: 'stopping', button: HIDDEN, opens: false });

		await stopping;

		expect(phaseOf(plugins)).toEqual({ phase: 'stopped', button: HIDDEN, opens: false });
	});
});
