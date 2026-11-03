import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import { forceAnimateArgument, type AnimateArgument } from '~/force/arguments';
import { rowMessageId, withRowFields } from '~/force/row-fields';
import { USER_SETTINGS_PATH } from '~/constants';

type Cleanup = () => void;

const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });

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
 * @description Renders a component with some props always set, once its module loads.
 * @param path The component module's file path; the component is its `default` export.
 * @param props The props to set.
 * @returns A function that stops waiting and removes the patch.
 */
export function forceProps(path: string, props: Record<string, unknown>): Cleanup {
	return whenLoaded<AnyProps>(path, (module) => {
		const target = findRenderTarget(module);

		if (!target) return;

		return patcher.before(target.holder, target.key, ({ args }) => {
			const [current, ...rest] = args;

			return [{ ...(current as object), ...props }, ...rest];
		});
	});
}

/**
 * @description Makes one of Discord's user settings read as a fixed value, in React and outside it.
 * @param name The setting's export name in Discord's user settings module, such as `AnimateEmoji`.
 * @param value The value the setting reads as.
 * @returns A function that stops waiting and removes the patches.
 */
export function forceUserSetting(name: string, value: unknown): Cleanup {
	return whenLoaded<AnyProps>(USER_SETTINGS_PATH, (module) => {
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
 * @description Sets row options of every chat message row Discord generates.
 * @param fieldsFor Returns the options to set for a row, from the id of the row's message.
 * @returns A function that removes the patch.
 */
export function forceRowFields(
	fieldsFor: (messageId: string | undefined) => Record<string, unknown>,
): Cleanup {
	return patcher.before(MessageRowData, 'generateMessageRowData', ({ args }) =>
		withRowFields(args, fieldsFor(rowMessageId(args[0]))),
	);
}
