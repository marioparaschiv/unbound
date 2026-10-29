import type { EditAddonRequest, MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import type { AddonType } from '@unbound-app/contracts/addons';

import type { ManifestSummary } from '~/lib/admin-addon';

export type ChangeKey = 'name' | 'type' | 'description' | 'repository' | 'delisted' | 'maintainers';

export type Change = {
	key: ChangeKey;
	label: string;
	before: string;
	after: string;
};

type ChangeContext = {
	manifest: ManifestSummary | null;
	users: Record<string, UserSummary>;
};

type ChangeSpec = {
	label: string;
	format: (values: EditAddonRequest, context: ChangeContext) => string;
};

export const TYPE_LABELS: Record<AddonType, string> = {
	plugin: 'Plugin',
	theme: 'Theme',
	'icon-pack': 'Icon pack',
	font: 'Font',
};

function listing(value: string | null, manifestValue: string | undefined): string {
	if (value === null) {
		return `${manifestValue || 'Empty'} (from manifest)`;
	}

	return value || 'Empty';
}

function members(list: MaintainerEntry[], users: ChangeContext['users']): string {
	return list
		.map((member) => `${users[member.userId]?.name ?? member.userId} (${member.role})`)
		.join(', ');
}

// One entry per editable field, in the order the page shows them; the summary and the before/after list read it.
const SPECS: Record<ChangeKey, ChangeSpec> = {
	name: {
		label: 'Name',
		format: (values, { manifest }) => listing(values.name, manifest?.name),
	},
	type: {
		label: 'Type',
		format: (values, { manifest }) =>
			listing(
				values.type && TYPE_LABELS[values.type],
				manifest ? TYPE_LABELS[manifest.type] : undefined,
			),
	},
	description: {
		label: 'Description',
		format: (values, { manifest }) => listing(values.description, manifest?.description),
	},
	repository: {
		label: 'Repository',
		format: (values) => values.repository ?? 'None',
	},
	maintainers: {
		label: 'Maintainers',
		format: (values, { users }) => members(values.maintainers, users),
	},
	delisted: {
		label: 'Visibility',
		format: (values) => (values.delisted ? 'Delisted' : 'Listed'),
	},
};

const KEYS = Object.keys(SPECS).filter((key): key is ChangeKey => key in SPECS);

/**
 * @description Lists what the form changes against the values it loaded, in words.
 * @param initial The values the form loaded.
 * @param current The form's values now.
 * @param context The manifest the listing fields follow and the users the maintainers name.
 * @returns One change per edited field, in page order.
 */
export function describeChanges(
	initial: EditAddonRequest,
	current: EditAddonRequest,
	context: ChangeContext,
): Change[] {
	return KEYS.filter((key) => JSON.stringify(initial[key]) !== JSON.stringify(current[key])).map(
		(key) => ({
			key,
			label: SPECS[key].label,
			before: SPECS[key].format(initial, context),
			after: SPECS[key].format(current, context),
		}),
	);
}

export default { TYPE_LABELS, describeChanges };
