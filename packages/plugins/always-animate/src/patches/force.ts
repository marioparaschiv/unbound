import { onMessageRow, type RowOptions } from '@unbound-plugins/shared/metro/message-rows';
import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import { forceAnimateArgument, type AnimateArgument } from '~/lib/arguments';
import { USER_SETTINGS_PATH } from '~/lib/constants';

type Cleanup = () => void;

const noop: Cleanup = () => {};

// `modules/guild/native/GuildIcon.tsx` -> `GuildIcon`, the name a warning reports.
function nameOf(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1).replace(/\.tsx?$/, '');
}

/**
 * @description Combines cleanups into one that runs them in reverse order.
 * @param cleanups The cleanups.
 * @returns A function that runs every cleanup once.
 */
export function combineCleanups(cleanups: Cleanup[]): Cleanup {
	return () => {
		for (const cleanup of cleanups.splice(0).reverse()) cleanup();
	};
}

/**
 * @description Applies patches to a module once Discord loads it, without loading it, and warns when this build has none.
 * @param path The module's source path.
 * @param apply Patches the module and returns the function that removes the patches.
 * @returns A function that stops waiting and removes the patches.
 */
export function onPathLoaded(path: string, apply: (module: AnyProps) => Cleanup | void): Cleanup {
	let remove: Cleanup | void;

	const stopWaiting = metro.onModuleLoaded(
		metro.filters.byFilePath(path),
		(module: AnyProps) => {
			remove = apply(module);
		},
		{ onMissing: () => logger.warn(`Animating ${nameOf(path)} skipped: Discord moved it.`) },
	);

	return () => {
		stopWaiting();
		remove?.();
		remove = undefined;
	};
}

function holdersOf(module: AnyProps): AnyProps[] {
	const holders = [module];
	const fallback = module.default;

	if (fallback && typeof fallback === 'object' && fallback !== module) holders.push(fallback);

	return holders;
}

/**
 * @description Makes the builders of a module, and of its `default` export, always build animated URLs or sources.
 * @param module The module's exports.
 * @param rules The builders to patch and the argument that makes each animate.
 * @returns A function that removes the patches.
 */
export function forceAnimateArguments(
	module: AnyProps,
	rules: readonly AnimateArgument[],
): Cleanup {
	const cleanups: Cleanup[] = [];

	for (const holder of holdersOf(module)) {
		for (const rule of rules) {
			if (typeof holder[rule.method] !== 'function') continue;

			cleanups.push(
				patcher.before(holder, rule.method, ({ args }) => forceAnimateArgument(args, rule)),
			);
		}
	}

	return combineCleanups(cleanups);
}

/**
 * @description Makes a function of a module, and of its `default` export, always return the same value.
 * @param module The module's exports.
 * @param method The function to patch.
 * @param value The value it returns.
 * @returns A function that removes the patches.
 */
export function forceResult(module: AnyProps, method: string, value: unknown): Cleanup {
	const cleanups: Cleanup[] = [];

	for (const holder of holdersOf(module)) {
		if (typeof holder[method] === 'function')
			cleanups.push(patcher.after(holder, method, () => value));
	}

	return combineCleanups(cleanups);
}

/**
 * @description Renders a component with some props always set. A component Discord moved is logged and left alone.
 * @param path The source path of the module that holds the component as its `default` export.
 * @param props The props to set.
 * @returns A function that removes the patch.
 */
export function forceProps(path: string, props: Record<string, unknown>): Cleanup {
	const component = metro.findByFilePath(path);

	if (!component) {
		logger.warn(`Animating ${nameOf(path)} skipped: Discord moved it.`);

		return noop;
	}

	return patcher.react.before(component, 'default', ({ props: current }) => ({
		...current,
		...props,
	}));
}

/**
 * @description Makes one of Discord's user settings read as a fixed value, in React and outside it.
 * @param name The setting's export name in Discord's user settings module, such as `AnimateEmoji`.
 * @param value The value the setting reads as.
 * @returns A function that stops waiting and removes the patches.
 */
export function forceUserSetting(name: string, value: unknown): Cleanup {
	return onPathLoaded(USER_SETTINGS_PATH, (module) => {
		const setting: AnyProps | undefined = module[name];

		if (!setting || typeof setting !== 'object') return;

		return combineCleanups(
			['getSetting', 'useSetting']
				.filter((method) => typeof setting[method] === 'function')
				.map((method) => patcher.after(setting, method, () => value)),
		);
	});
}

/**
 * @description Sets row options of every chat message row Discord generates; a row built without options is left alone.
 * @param fieldsFor Returns the options to set for a row, from the id of the row's message.
 * @returns A function that removes the patch.
 */
export function forceRowFields(fieldsFor: (messageId: string | undefined) => RowOptions): Cleanup {
	return onMessageRow({
		feature: 'Animating message rows',
		before: ({ message, options }) =>
			options && { options: { ...options, ...fieldsFor(message?.id) } },
	});
}
