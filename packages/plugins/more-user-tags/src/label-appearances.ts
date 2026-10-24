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

	function set(label: string, appearance: RoleColorAppearance) {
		if (!label.trim()) return;

		const colors = appearance.colors
			.filter((color) => HEX_COLOR.test(color))
			.map((color) => color.toLowerCase());

		if (!colors.length) {
			const prefix = getRoleGradientKey(label, '');

			for (const key of entries.keys()) {
				if (key.startsWith(prefix)) entries.delete(key);
			}

			return;
		}

		entries.set(getRoleGradientKey(label, colors[0]), { colors, style: appearance.style });
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

	return {
		set,
		find,
		clear: () => entries.clear(),
		isEmpty: () => entries.size === 0,
	};
}

export default { createLabelAppearances };
