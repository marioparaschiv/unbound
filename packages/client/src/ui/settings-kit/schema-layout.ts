import type {
	ButtonSchema,
	NoticeSchema,
	SettingCommon,
	SettingSchema,
	SettingsSchema,
	StorelessSchema,
} from '@unbound-app/types/settings';
import { isButton, isNotice, isSettingsGroup } from '@unbound-app/contracts/settings-schema';

/** One row of a generated settings panel: a stored setting, an action or a notice, at its dot-separated key. */
export type LayoutItem =
	| { kind: 'setting'; path: string; field: SettingSchema }
	| { kind: 'button'; path: string; field: ButtonSchema }
	| { kind: 'notice'; path: string; field: NoticeSchema };

/** A row of a stored setting. */
export type SettingItem = Extract<LayoutItem, SettingKind>;

type SettingKind = { kind: 'setting' };

/** A run of rows drawn together: inline rows share one group; a radio group, checklist or list stands alone. */
export type LayoutBlock = { inline: boolean; items: LayoutItem[] };

/** One section of a generated settings panel: the top-level settings, or a `setting.section`. */
export type LayoutSection = {
	/** The section's key; empty for the top-level settings. */
	path: string;
	labels: SettingCommon;
	collapsible: boolean;
	blocks: LayoutBlock[];
};

/**
 * @description Tells whether a row is drawn inside a shared group: every row but a radio group, an array and a notice, which
 * stand alone.
 * @param item The row.
 * @returns Whether it is inline.
 */
export function isInline(item: LayoutItem): boolean {
	const { field } = item;

	switch (field.kind) {
		case 'button':
		case 'boolean':
		case 'number':
		case 'integer':
		case 'string':
			return true;
		case 'choice':
			return field.displayAs !== 'radio';
		case 'array':
		case 'notice':
			return false;
	}
}

function itemOf(path: string, node: SettingSchema | StorelessSchema): LayoutItem {
	if (isButton(node)) {
		return { kind: 'button', path, field: node };
	}

	return isNotice(node)
		? { kind: 'notice', path, field: node }
		: { kind: 'setting', path, field: node };
}

function blocksOf(items: LayoutItem[]): LayoutBlock[] {
	const blocks: LayoutBlock[] = [];

	for (const item of items) {
		if (item.field.hidden) {
			continue;
		}

		const inline = isInline(item);
		const last = blocks.at(-1);

		if (inline && last?.inline) {
			last.items.push(item);
		} else {
			blocks.push({ inline, items: [item] });
		}
	}

	return blocks;
}

/**
 * @description Lays a settings schema out as a panel: the top-level settings, then one section per `setting.section`;
 * hidden settings are left out, and each section's rows are grouped into blocks.
 * @param schema The schema.
 * @returns The sections, in order.
 */
export function schemaLayout(schema: SettingsSchema): LayoutSection[] {
	const top: LayoutItem[] = [];
	const sections: LayoutSection[] = [];

	for (const [key, node] of Object.entries(schema.properties)) {
		if (!isSettingsGroup(node)) {
			top.push(itemOf(key, node));
			continue;
		}

		if (node.hidden) {
			continue;
		}

		sections.push({
			path: key,
			labels: node,
			collapsible: node.displayAs === 'collapsible',
			blocks: blocksOf(
				Object.entries(node.properties).map(([child, field]) =>
					itemOf(`${key}.${child}`, field),
				),
			),
		});
	}

	return [
		{ path: '', labels: { title: schema.title }, collapsible: false, blocks: blocksOf(top) },
		...sections,
	];
}
