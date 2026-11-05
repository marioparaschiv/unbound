import type {
	UnboundFontVariant,
	UnboundResolvedFont,
	UnboundResolvedFontFile,
} from '@unbound-app/types';
import { useState } from 'react';

import { Manager } from '~/addons/manager';
import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

/** A file the resolver named a weight and style for, which the picker can toggle. */
export type FontVariantChoice = UnboundFontVariant & { key: string };

function variantOf(file: UnboundResolvedFontFile): FontVariantChoice | undefined {
	if (file.weight === null) {
		return undefined;
	}

	const style = file.style ?? 'normal';

	return { key: `${file.weight}-${style}`, weight: file.weight, style };
}

/**
 * @description The install sheet's logic: resolves the typed name or link, offers its weights and styles,
 * and installs the chosen ones. Archives and direct links list no variants; every font in them installs.
 * @param onDone Called once the font installed.
 * @returns The input, the resolved font and its variants, the selection, and the actions.
 */
function useFontInstall(onDone: () => void) {
	const fonts = Manager.for('font');
	const [input, setInput] = useState('');
	const [resolved, setResolved] = useState<UnboundResolvedFont | undefined>(undefined);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	const variants = (resolved?.files ?? []).flatMap((file) => variantOf(file) ?? []);
	const wholeFiles = (resolved?.files ?? []).some((file) => file.weight === null);

	function edit(text: string) {
		setInput(text);
		setResolved(undefined);
		setError(undefined);
	}

	async function find() {
		const query = input.trim();

		if (!query || busy) return;

		setBusy(true);

		const font = await fonts.resolve(query);

		setBusy(false);
		setResolved(font);
		setError(font ? undefined : fonts.errors.get(query)?.message);
		setSelected(new Set((font?.files ?? []).flatMap((file) => variantOf(file)?.key ?? [])));
	}

	function toggle(key: string) {
		const next = new Set(selected);

		if (!next.delete(key)) {
			next.add(key);
		}

		setSelected(next);
	}

	async function install() {
		const query = input.trim();

		if (!resolved || busy) return;

		setBusy(true);

		const chosen = variants.filter((variant) => selected.has(variant.key));
		const result = await fonts.install(
			query,
			chosen.length > 0 && !wholeFiles
				? chosen.map(({ weight, style }) => ({ weight, style }))
				: undefined,
		);

		setBusy(false);

		if (!result) {
			setError(fonts.errors.get(query)?.message);

			return;
		}

		show({
			title: resolved.family,
			content: format('UNBOUND_FONTS_INSTALLED_TOAST', {
				count: result.installed.length,
				family: resolved.family,
			}),
			icon: 'CircleCheckIcon',
		});
		onDone();
	}

	return {
		input,
		edit,
		resolved,
		variants,
		wholeFiles,
		selected,
		toggle,
		busy,
		error,
		find,
		install,
	};
}

export default useFontInstall;
