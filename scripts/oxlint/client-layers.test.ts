import { dirname, resolve } from 'node:path';
import { expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { Glob } from 'bun';

import { flaggedFiles, lintFixture } from './lint-fixture';
import config from '../../.oxlintrc.json';

const CLIENT = 'packages/client/src';
const source = resolve(import.meta.dir, '../..', CLIENT);
const builtins = [...new Glob('*/builtin.{ts,tsx}').scanSync({ cwd: source })].sort();

function clientLayers() {
	const [, options] = config.rules['unbound/no-upward-imports'];

	if (typeof options !== 'object') {
		throw new Error('.oxlintrc.json configures unbound/no-upward-imports without layers.');
	}

	const domains = options.layers.find((layer) => layer.from.includes(`${CLIENT}/core`));
	const ui = options.layers.find((layer) => layer.from.includes(`${CLIENT}/ui`));

	if (!domains || !ui) {
		throw new Error('.oxlintrc.json has no client domain layer or no client ui layer.');
	}

	return {
		domains: {
			from: domains.from,
			deny: domains.deny,
			except: domains.except ?? [],
			because: domains.because,
		},
		ui: { from: ui.from, deny: ui.deny, because: ui.because },
	};
}

const { domains, ui } = clientLayers();

test('only the domain builtin files on disk and the public barrel may import ui/', () => {
	expect([...domains.except].sort()).toEqual(
		[
			...builtins.map((file) => `${CLIENT}/${file}`),
			`${CLIENT}/builtins/error-boundary.tsx`,
			`${CLIENT}/core/api.ts`,
		].sort(),
	);
});

test('ui/ may not import any domain builtin on disk', () => {
	expect([...ui.deny].sort()).toEqual(
		['~/builtins', ...builtins.map((file) => `~/${dirname(file)}/builtin`)].sort(),
	);
});

test('every client folder outside ui/ is under the ui/ ban', () => {
	const folders = readdirSync(source, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name !== 'ui')
		.map((entry) => `${CLIENT}/${entry.name}`);

	expect(folders.filter((folder) => !domains.from.includes(folder))).toEqual([]);
});

test('a domain file importing ui/ fails lint, and its builtin does not', async () => {
	const findings = await lintFixture(
		'no-upward-imports',
		{
			[`${CLIENT}/metro/probe.ts`]:
				"import Toast from '~/ui/toasts/toast';\nexport const a = Toast;",
			[`${CLIENT}/settings/probe.tsx`]:
				"import GeneralPage from '~/ui/settings/general';\nexport const a = GeneralPage;",
			[`${CLIENT}/metro/nested/builtin.ts`]:
				"import Toast from '~/ui/toasts/toast';\nexport const a = Toast;",
			[`${CLIENT}/settings/builtin.tsx`]:
				"import GeneralPage from '~/ui/settings/general';\nexport const a = GeneralPage;",
			[`${CLIENT}/ui/probe.ts`]:
				"import settings from '~/settings/builtin';\nexport const a = settings;",
			[`${CLIENT}/ui/domain.ts`]:
				"import { useUnboundSettings } from '~/settings/unbound';\nexport const a = useUnboundSettings;",
		},
		{ layers: [domains, ui] },
	);

	expect(flaggedFiles(findings)).toEqual([
		`${CLIENT}/metro/nested/builtin.ts`,
		`${CLIENT}/metro/probe.ts`,
		`${CLIENT}/settings/probe.tsx`,
		`${CLIENT}/ui/probe.ts`,
	]);
});
