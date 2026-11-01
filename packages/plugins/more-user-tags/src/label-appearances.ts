import {
	getRoleGradientKey,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';

import { HEX_COLOR } from '~/constants';

export type LabelAppearance = { primaryColor: string; appearance: RoleColorAppearance };

export type LabelAppearances = ReturnType<typeof createLabelAppearances>;

/**
 * @description Remembers the colors chosen for each tag text, so the native renderer can find a label's gradient.
 * @returns `set` records a tag's colors, `find` looks a native label up, `clear` forgets everything.
 */
export function createLabelAppearances() {
	const entries = new Map<string, RoleColorAppearance>();
	const listeners = new Set<() => void>();
	let revision = 0;

	function changed() {
		revision++;

		for (const listener of listeners) listener();
	}

	function set(label: string, appearance: RoleColorAppearance) {
		if (!label.trim()) return;

		const colors = appearance.colors
			.filter((color) => HEX_COLOR.test(color))
			.map((color) => color.toLowerCase());

		if (!colors.length) {
			const prefix = getRoleGradientKey(label, '');
			const stale = [...entries.keys()].filter((key) => key.startsWith(prefix));

			for (const key of stale) entries.delete(key);

			if (stale.length) changed();

			return;
		}

		const key = getRoleGradientKey(label, colors[0]);
		const existing = entries.get(key);

		if (
			existing?.style === appearance.style &&
			existing.colors.join(':') === colors.join(':')
		) {
			return;
		}

		entries.set(key, { colors, style: appearance.style });
		changed();
	}

	// A native label's background tells us its primary color; without one, only an unambiguous match counts.
	function find(label: string, primaryColor: string | null): LabelAppearance | null {
		if (primaryColor) {
			const appearance = entries.get(getRoleGradientKey(label, primaryColor));

			if (appearance) return { primaryColor, appearance };
		}

		const prefix = getRoleGradientKey(label, '');
		const unique = new Map<string, LabelAppearance>();

		for (const [key, appearance] of entries) {
			if (!key.startsWith(prefix)) {
				continue;
			}

			unique.set(JSON.stringify(appearance), {
				primaryColor: key.slice(prefix.length),
				appearance,
			});
		}

		return unique.size === 1 ? [...unique.values()][0] : null;
	}

	function has(label: string): boolean {
		const prefix = getRoleGradientKey(label, '');

		for (const key of entries.keys()) {
			if (key.startsWith(prefix)) return true;
		}

		return false;
	}

	return {
		set,
		find,
		has,
		clear: () => {
			entries.clear();
			changed();
		},
		snapshot: (): Record<string, RoleColorAppearance> => Object.fromEntries(entries),
		subscribe(listener: () => void) {
			listeners.add(listener);

			return () => void listeners.delete(listener);
		},
		revision: () => revision,
		isEmpty: () => entries.size === 0,
	};
}

export default { createLabelAppearances };
