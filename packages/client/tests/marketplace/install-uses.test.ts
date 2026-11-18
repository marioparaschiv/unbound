import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { installUses } from '~/marketplace/install-uses';

function manifest(overrides: Partial<AddonManifest> = {}): AddonManifest {
	return {
		id: 'example.plugin',
		name: 'Example',
		description: '',
		authors: [{ name: 'Author', id: '1' }],
		main: 'index.js',
		version: '1.0.0',
		...overrides,
	};
}

describe('installUses', () => {
	test('lists hosts, native hooks and direct native calls in order', () => {
		const uses = installUses(
			manifest({
				network: ['api.example.com', '*.cdn.example.com'],
				platforms: {
					ios: { capabilities: ['native.objc.hooks', 'native.ffi.call'] },
				},
			}),
		);

		expect(uses).toEqual([
			{ key: 'UNBOUND_INSTALL_REVIEW_HOSTS', hosts: 'api.example.com, *.cdn.example.com' },
			{ key: 'UNBOUND_INSTALL_REVIEW_HOOKS' },
			{ key: 'UNBOUND_INSTALL_REVIEW_FFI' },
		]);
	});

	test('lists nothing for a plain plugin or a first-party one', () => {
		expect(installUses(manifest({ capabilities: ['native.objc.invoke'] }))).toEqual([]);
		expect(
			installUses(manifest({ id: 'unbound.example', capabilities: ['native.java.hooks'] })),
		).toEqual([]);
	});
});
