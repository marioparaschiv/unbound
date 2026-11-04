import type { Settings } from '@unbound-app/settings';

declare module '@unbound-app/api/testing' {
	// oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
	interface PluginTypes {
		settings: Settings;
		locale: 'en-US' | 'de';
	}
}
