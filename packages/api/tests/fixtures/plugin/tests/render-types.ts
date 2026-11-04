import { render, setLocale } from '@unbound-app/api/testing';

/** Never called: tsc checks that `PluginTypes` types `render`'s options and `setLocale`. */
export function renderTypes(): void {
	// @ts-expect-error The plugin ships no fr.json.
	render(null, { locale: 'fr' });
	// @ts-expect-error `size` is a number.
	render(null, { settings: { appearance: { size: 'big' } } });
	// @ts-expect-error The plugin has no `missing` setting.
	render(null, { settings: { missing: true } });
	// @ts-expect-error The plugin ships no fr.json.
	setLocale('fr');
	render(null, { settings: { appearance: { accent: '#ffffff' } }, locale: 'de' });
}
