// Type tests of the `@unbound-app/settings/schema` builders; `bun run typecheck` runs them.
import { defineSettings, setting } from '@unbound-app/settings/schema';

export const valid = defineSettings({
	a: setting.boolean({ default: true, title: 'COMPACT' }),
	b: setting.boolean({ default: true, title: 'COMPACT', displayAs: 'checkbox' }),
	c: setting.number({ default: 1, title: 'LIMIT' }),
	d: setting.number({ default: 1, min: 0, max: 2, title: 'LIMIT' }),
	e: setting.number({ default: 1, step: 0.5, title: 'LIMIT', displayAs: 'stepper' }),
	f: setting.integer({ default: 1, title: 'LIMIT', displayAs: 'stepper' }),
	g: setting.integer({
		default: 1000,
		title: 'TIMEOUT',
		displayAs: 'duration',
		units: ['s', 'm'],
	}),
	h: setting.string({ default: '', title: 'BIO', displayAs: 'multiline', placeholder: 'BIO' }),
	i: setting.string({ default: 'https://unbound.rip', title: 'HOMEPAGE', displayAs: 'url' }),
	j: setting.string({ default: '#000000', title: 'ACCENT', displayAs: 'color', alpha: true }),
	k: setting.string({ title: 'OWNER', displayAs: 'guild' }),
	l: setting.string({ title: 'OWNER', displayAs: 'emoji', default: 'wave' }),
	m: setting.choice({
		default: 'x',
		title: 'STYLE',
		options: {
			x: 'STYLE_COZY',
			y: { title: 'STYLE_COMPACT', subtitle: 'STYLE_COZY_SUBTITLE' },
		},
	}),
	n: setting.array({
		title: 'TAGS',
		of: setting.choice({ options: { a: 'TAG_A' } }),
		default: ['a'],
	}),
	o: setting.array({ title: 'WORDS', of: setting.string(), displayAs: 'role' }),
	p: setting.boolean({ default: false, hidden: true }),
	q: setting.boolean({
		default: true,
		title: 'COMPACT',
		visibleWhen: (settings) => settings.style === 'cozy' && settings.tags.length > 0,
	}),
	r: setting.boolean({ default: true, title: 'COMPACT', disabledWhen: 'greetOnStart' }),
	s: setting.button({ title: 'CLEAR_CACHE', action: 'resetStyle' }),
	t: setting.section(
		{ title: 'APPEARANCE', displayAs: 'collapsible' },
		{ u: setting.boolean({ default: true, title: 'COMPACT' }) },
	),
});

// @ts-expect-error Every visible setting needs a title.
setting.boolean({ default: true });
// @ts-expect-error A title is a key of i18n/en-US.json.
setting.boolean({ default: true, title: 'Compact' });
// @ts-expect-error A slider needs `min` and `max`.
setting.number({ default: 1, title: 'LIMIT', displayAs: 'slider' });
// @ts-expect-error A number stepper needs `step`.
setting.number({ default: 1, title: 'LIMIT', displayAs: 'stepper' });
// @ts-expect-error `step` goes with a slider or stepper, not an input.
setting.number({ default: 1, title: 'LIMIT', step: 1 });
// @ts-expect-error `units` goes with a duration.
setting.integer({ default: 1, title: 'LIMIT', units: ['s'] });
// @ts-expect-error `alpha` goes with a color.
setting.string({ default: '', title: 'BIO', alpha: true });
// @ts-expect-error A color default is a hex string.
setting.string({ default: 'red', title: 'ACCENT', displayAs: 'color' });
// @ts-expect-error A palette needs presets.
setting.string({ default: '#000000', title: 'ACCENT', displayAs: 'color', palette: true });
// @ts-expect-error A URL default is http or https.
setting.string({ default: 'ftp://x', title: 'HOMEPAGE', displayAs: 'url' });
// @ts-expect-error A choice's default is one of its options.
setting.choice({ default: 'z', title: 'STYLE', options: { x: 'STYLE_COZY' } });
// @ts-expect-error An option label is a message key.
setting.choice({ default: 'x', title: 'STYLE', options: { x: 'Cozy' } });
setting.array({
	title: 'TAGS',
	of: setting.choice({ options: { a: 'TAG_A' } }),
	// @ts-expect-error Choices show as checkboxes, not a list.
	displayAs: 'list',
});
// @ts-expect-error Strings show as a list or an entity picker, not checkboxes.
setting.array({ title: 'WORDS', of: setting.string(), displayAs: 'checkboxes' });
// @ts-expect-error A shorthand condition names a boolean setting.
setting.boolean({ default: true, title: 'COMPACT', visibleWhen: 'style' });
// @ts-expect-error A predicate reads only known settings.
setting.boolean({ default: true, title: 'COMPACT', visibleWhen: (s) => s.missing });
// @ts-expect-error A button runs a function src/actions.ts exports.
setting.button({ title: 'CLEAR_CACHE', action: 'clearCash' });

defineSettings({
	// @ts-expect-error A raw TypeBox schema has no title, so `defineSettings` takes only builders.
	raw: { type: 'boolean', default: true },
});

defineSettings({
	// @ts-expect-error An array item is not a setting on its own.
	item: setting.string(),
});
