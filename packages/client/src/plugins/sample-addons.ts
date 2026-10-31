import noop from '@unbound-app/utils/noop';

import type { ManagerActions } from '~/addons/addon';
import { Addon } from '~/addons/addon';

const inertManager: ManagerActions = {
	kind: 'plugin',
	isEnabled: () => false,
	enable: noop,
	disable: noop,
	restart: () => Promise.resolve(),
};

/** Development-only addon manifests used to review addon-card layout without installed plugins. */
const sampleAddons: Addon[] = [
	new Addon(
		{
			manifest: {
				id: 'unbound-preview-better-embeds',
				type: 'plugin',
				name: 'Better Embeds',
				description:
					'Makes media embeds easier to read with richer previews, cleaner spacing, and quick actions.',
				authors: [
					{ name: 'Ari', id: '100000000000000001' },
					{ name: 'Mika', id: '100000000000000002' },
				],
				version: '2.4.1',
				main: 'index.js',
			},
			bundle: '',
			instance: null,
			context: void 0,
			scope: void 0,
			started: false,
			failed: false,
		},
		inertManager,
	),
	new Addon(
		{
			manifest: {
				id: 'unbound-preview-quiet-typing',
				type: 'plugin',
				name: 'Quiet Typing',
				description:
					'Hides typing indicators while keeping everything else exactly as it is.',
				authors: [{ name: 'Noelle', id: '100000000000000003' }],
				version: '1.0.0',
				main: 'index.js',
			},
			bundle: '',
			instance: null,
			context: void 0,
			scope: void 0,
			started: false,
			failed: false,
		},
		inertManager,
	),
];

export default sampleAddons;
