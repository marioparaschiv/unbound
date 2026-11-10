import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { ToastOptions } from '@unbound-app/types/toasts';

import type { LooseMessageVars } from '~/i18n/message';
import type { AlertDialogProps } from '~/dialogs/api';

import { makeManifest, resetDevice, states } from '../helpers/addons';

const patcherApi = await import('~/patcher/api');
const { Plugins } = await import('~/plugins/manager');

const ID = 'feedback.example';
const shown: ToastOptions[] = [];
const dialogs: AlertDialogProps[] = [];

const { createAddonLocales } = await import('~/i18n/addon-locales');

// The real `createLocales` reaches Discord's MessageFormat; its addon locales need only a formatter.
const i18n = {
	createLocales: (
		fallback: Record<string, string>,
		source: Parameters<typeof createAddonLocales>[1],
	) =>
		createAddonLocales(fallback, source, (messages, key, vars?: LooseMessageVars) =>
			(messages[key] ?? key).replace('{count}', String(vars?.count)),
		),
};

function startPlugin(bundle: string) {
	const plugins = new Plugins();

	plugins.load(bundle, makeManifest(ID));
	expect(plugins.errors.get(ID)).toBeUndefined();

	return plugins;
}

beforeEach(() => {
	resetDevice();
	states[ID] = true;
	shown.length = 0;
	dialogs.length = 0;
	Reflect.set(globalThis, 'window', globalThis);
	Reflect.set(globalThis, 'React', { createElement: () => null });
	Reflect.set(globalThis, 'unbound', {
		patcher: patcherApi,
		i18n,
		toasts: { show: (options: ToastOptions) => void shown.push(options) },
		dialogs: {
			showDialog: (options: AlertDialogProps) => {
				dialogs.push(options);

				return { key: 'k', dismiss: () => undefined };
			},
		},
	});
	Reflect.set(globalThis, '__feedback', {});
});

afterEach(() => {
	for (const key of ['React', 'unbound', 'window', '__feedback']) {
		Reflect.deleteProperty(globalThis, key);
	}
});

describe('plugin feedback shorthands', () => {
	test("resolve the plugin's own keys through the locales it creates, and core's for the defaults", async () => {
		startPlugin(`({
			start() {
				unbound.i18n.createLocales({ SAVED: 'Saved', SAVED_N: 'Saved {count} items', DELETE: 'Delete' });
				unbound.toasts.success('SAVED', { duration: 0 });
				unbound.toasts.info('SAVED_N', { count: 3 });
				unbound.toasts.error(new Error('Offline'));
				globalThis.__feedback.answer = unbound.dialogs.confirm('SAVED', { confirm: 'DELETE' });
			},
			stop() {},
		})`);

		expect(shown).toEqual([
			{ title: 'Saved', icon: 'CircleCheckIcon', duration: 0 },
			{ title: 'Saved 3 items', icon: 'CircleInformationIcon' },
			{ title: 'Something went wrong', content: 'Offline', icon: 'CircleXIcon' },
		]);
		expect(dialogs[0]).toMatchObject({ title: 'Saved', cancel: 'Cancel' });
		expect(dialogs[0]?.buttons?.[0]?.label).toBe('Delete');

		dialogs[0]?.onDismiss?.();
		expect(await Reflect.get(Reflect.get(globalThis, '__feedback'), 'answer')).toBe(false);
	});

	test('show a key as itself before the plugin creates its locales', () => {
		startPlugin(`({
			start() { unbound.toasts.warning('NOT_DEFINED'); },
			stop() {},
		})`);

		expect(shown).toEqual([{ title: 'NOT_DEFINED', icon: 'WarningIcon' }]);
	});
});
