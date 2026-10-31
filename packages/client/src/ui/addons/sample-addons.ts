import type { Addon } from '@unbound-app/types';

/** Development-only addon manifests used to review addon-card layout without installed plugins. */
const sampleAddons: Addon[] = [
	{
		id: 'unbound-preview-better-embeds',
		started: false,
		failed: false,
		instance: null,
		bundle: '',
		data: {
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
	},
	{
		id: 'unbound-preview-quiet-typing',
		started: false,
		failed: false,
		instance: null,
		bundle: '',
		data: {
			id: 'unbound-preview-quiet-typing',
			type: 'plugin',
			name: 'Quiet Typing',
			description: 'Hides typing indicators while keeping everything else exactly as it is.',
			authors: [{ name: 'Noelle', id: '100000000000000003' }],
			version: '1.0.0',
			main: 'index.js',
		},
	},
];

export default sampleAddons;
