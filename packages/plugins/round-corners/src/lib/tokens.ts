import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import { FULL } from '~/lib/rounder';

type ResolveContext = { enabledExperiments?: unknown[] };

const REDESIGN_EXPERIMENTS = /^mobile-visual-refresh/;

function tokenNamed(name: string): AnyProps | undefined {
	const Tokens = metro.findByProps('unsafe_rawColors', 'radii');
	const groups: Record<string, Record<string, AnyProps>> | undefined = Tokens?.modules;
	const dot = name.indexOf('.');

	return dot === -1
		? groups?.mobile?.[name]
		: groups?.[name.slice(0, dot)]?.[name.slice(dot + 1)];
}

function capped(value: unknown): unknown {
	return typeof value === 'number' && value > FULL ? FULL : value;
}

function patchResolve(
	name: string,
	resolve: (
		stock: unknown,
		context: ResolveContext | undefined,
		original: (...args: unknown[]) => unknown,
	) => unknown,
) {
	const token = tokenNamed(name);

	if (typeof token?.resolve !== 'function') return;

	patcher.instead(token, 'resolve', ({ args, original }) =>
		resolve(undefined, args[0] as ResolveContext | undefined, original),
	);
}

/**
 * @description Makes corner tokens fully round while `active()` holds, so React Native draws circles and pills.
 * @param names Token names; `NAME` is a mobile token and `group.NAME` any other group's.
 * @param active Reads the setting that turns it on.
 */
export function roundTokens(names: readonly string[], active: () => boolean): void {
	for (const name of names) {
		patchResolve(name, (_stock, context, original) => {
			const value = original(context);

			return active() && typeof value === 'number' ? FULL : value;
		});
	}
}

/**
 * @description Resolves corner tokens as they were before the redesign while `active()` holds, by leaving its experiments out.
 * @param names Token names; `NAME` is a mobile token and `group.NAME` any other group's.
 * @param active Reads the setting that turns it on.
 */
export function classicTokens(names: readonly string[], active: () => boolean): void {
	for (const name of names) {
		patchResolve(name, (_stock, context, original) => {
			if (!active()) return original(context);

			const experiments = context?.enabledExperiments;
			const classic = Array.isArray(experiments)
				? {
						...context,
						enabledExperiments: experiments.filter(
							(experiment) => !REDESIGN_EXPERIMENTS.test(String(experiment)),
						),
					}
				: context;

			return capped(original(classic));
		});
	}
}

/**
 * @description Overrides one corner token while `active()` holds.
 * @param name The token's name.
 * @param active Reads the setting that turns it on.
 * @param value Picks the corner from Discord's own.
 */
export function overrideToken(
	name: string,
	active: () => boolean,
	value: (stock: number) => number,
): void {
	patchResolve(name, (_stock, context, original) => {
		const stock = original(context);

		return active() && typeof stock === 'number' ? value(stock) : stock;
	});
}
