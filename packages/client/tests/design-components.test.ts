import { DESIGN_COMPONENTS } from '@unbound-app/types/components';
import { describe, expect, mock, test } from 'bun:test';
import { forwardRef, memo } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

await import('./helpers/addons');

mock.module('~/api/metro/search', () => ({
	findByName: () => undefined,
	findByProps: () => undefined,
}));

const components = await import('~/api/metro/components');
const fallbacks = await import('~/ui/components/design-fallbacks');

const COMPONENT_TYPE = /^\t(\w+): (?:ComponentType<|TableRowComponent|ButtonComponent)/;

function designModuleComponentKeys(): string[] {
	const source = readFileSync(join(import.meta.dir, '../../types/typings/components.ts'), 'utf8');
	const block = source.slice(source.indexOf('export type DesignModule = {'));
	const body = block.slice(0, block.indexOf('\n};'));

	return body
		.split('\n')
		.map((line) => COMPONENT_TYPE.exec(line)?.[1])
		.filter((key): key is string => key !== undefined);
}

describe('design components', () => {
	test('lists every component the DesignModule type declares', () => {
		expect<string[]>([...DESIGN_COMPONENTS].sort()).toEqual(designModuleComponentKeys().sort());
	});

	test('recognises every kind of renderable React type', () => {
		expect(components.isRenderable(() => null)).toBe(true);
		expect(components.isRenderable(memo(() => null))).toBe(true);
		expect(components.isRenderable(forwardRef(() => null))).toBe(true);
		expect(components.isRenderable({ Text: () => null })).toBe(false);
		expect(components.isRenderable(undefined)).toBe(false);
	});

	test('exports only renderable components even without Discord', () => {
		expect(components.isRenderable(components.Switch)).toBe(true);
		expect(components.isRenderable(components.HelpMessage)).toBe(true);
	});

	test('stands in with fallbacks for components the build lacks', () => {
		expect(components.Discord.Text).toBe(fallbacks.FallbackText);
		expect(components.Discord.Heading).toBe(fallbacks.FallbackHeading);
		expect(components.Discord.FormSwitch).toBe(fallbacks.FallbackSwitch);
		expect(components.Discord.Stack).toBe(fallbacks.FallbackStack);
		expect(components.Discord.Card).toBe(fallbacks.FallbackCard);
		expect(components.isRenderable(components.Discord.SearchField)).toBe(true);
		expect(components.Discord.Button).toBeUndefined();
		expect('Text' in components.Discord).toBe(true);
	});

	test('registered fallbacks take over for missing components', () => {
		const Slider = () => null;

		components.registerDesignFallback('Slider', Slider);

		expect(components.Discord.Slider).toBe(Slider);
	});

	test('audits how each component resolves', () => {
		const audit = components.auditDesignComponents();

		expect(audit.native).toEqual([]);
		expect(audit.fallback).toEqual(
			expect.arrayContaining([
				'SearchField',
				'Text',
				'Heading',
				'FormSwitch',
				'Stack',
				'Card',
			]),
		);
		expect<string[]>([...audit.native, ...audit.fallback, ...audit.missing].sort()).toEqual(
			[...DESIGN_COMPONENTS].sort(),
		);
	});
});
