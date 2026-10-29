import type { ComponentRecord, HookCall, PropEvidence } from './types';
import type { Resolver } from './resolve';

import { isHookName } from './evidence';

/** The props the hooks a component passes its props to read from them, with the hooks' evidence. */
export type HookReads = (component: ComponentRecord) => Map<string, PropEvidence>;

/**
 * @description Builds the lookup of the props a component's hooks read, following hooks that hand their argument
 * on to further hooks. A key the passed object sets over the props is not read from them.
 * @param resolve The cross-module resolver.
 * @returns The lookup; results for hooks are memoised.
 */
export function createHookReads(resolve: Resolver): HookReads {
	const memo = new Map<ComponentRecord, Map<string, PropEvidence>>();

	function hookOf(call: HookCall): ComponentRecord | undefined {
		if (call.hook.kind === 'local') {
			return call.hook.component;
		}

		const resolved = resolve(call.hook);

		return resolved?.kind === 'function' && isHookName(resolved.fn.name)
			? resolved.fn
			: undefined;
	}

	// Memoised before recursing, so a cycle of hooks sees the reads gathered so far and terminates.
	function argumentProps(hook: ComponentRecord): Map<string, PropEvidence> {
		const known = memo.get(hook);

		if (known) {
			return known;
		}

		const props = new Map(hook.props);

		memo.set(hook, props);

		for (const [key, evidence] of reads(hook.hookCalls)) {
			if (!props.has(key)) {
				props.set(key, evidence);
			}
		}

		return props;
	}

	function reads(calls: HookCall[]): Map<string, PropEvidence> {
		const props = new Map<string, PropEvidence>();

		for (const call of calls) {
			const hook = hookOf(call);

			if (!hook) {
				continue;
			}

			for (const [key, evidence] of argumentProps(hook)) {
				if (!props.has(key) && !call.sets.includes(key)) {
					props.set(key, evidence);
				}
			}
		}

		return props;
	}

	return (component) => reads(component.hookCalls);
}

export default { createHookReads };
