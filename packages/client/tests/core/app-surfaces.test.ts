import { createElement, type ComponentType, type ReactElement } from 'react';
import { beforeEach, describe, expect, test } from 'bun:test';

import {
	adoptRestartedSurface,
	surfacePrefix,
	type SurfaceHolder,
	type SurfaceProps,
	type SurfaceRegistry,
} from '~/core/app-surfaces';

type Root = ComponentType<SurfaceProps>;
type SurfaceFunction = (props: SurfaceProps) => ReactElement | null;
type Holders = Record<string, SurfaceHolder>;
type SurfaceScope = typeof globalThis & { __unboundAppSurfaces?: Holders };

function registry(keys: string[] = []) {
	const registered = new Map<string, () => Root>();
	const target: SurfaceRegistry = {
		registerComponent: (key, provider) => {
			registered.set(key, provider as () => Root);

			return key;
		},
		getAppKeys: () => [...keys, ...registered.keys()],
	};

	return { target, registered };
}

function holders(): Holders {
	return (globalThis as SurfaceScope).__unboundAppSurfaces ?? {};
}

beforeEach(() => {
	delete (globalThis as SurfaceScope).__unboundAppSurfaces;
});

describe('surfacePrefix', () => {
	test('reads a plugin surface key', () => {
		expect(surfacePrefix('ReactionAvatarSurface0')).toBe('ReactionAvatarSurface');
		expect(surfacePrefix('MessageLinkEmbedSurface12')).toBe('MessageLinkEmbedSurface');
	});

	test('ignores other app keys', () => {
		expect(surfacePrefix('Discord')).toBeUndefined();
		expect(surfacePrefix('ReactionAvatarSurface')).toBeUndefined();
	});
});

describe('adoptRestartedSurface', () => {
	test('registers a restarted surface that renders nothing until its plugin returns', () => {
		const { target, registered } = registry();

		expect(adoptRestartedSurface(target, 'ReactionAvatarSurface0', createElement)).toBe(true);

		const Surface = registered.get('ReactionAvatarSurface0')!() as SurfaceFunction;

		expect(Surface({})).toBeNull();

		const Avatar: Root = () => null;

		holders().ReactionAvatarSurface.current = Avatar;

		expect(Surface({ surfaceId: 1 })).toEqual(createElement(Avatar, { surfaceId: 1 }));
	});

	test('leaves keys that are already registered or not surfaces', () => {
		const { target, registered } = registry(['ReactionAvatarSurface0']);

		expect(adoptRestartedSurface(target, 'ReactionAvatarSurface0', createElement)).toBe(false);
		expect(adoptRestartedSurface(target, 'Discord', createElement)).toBe(false);
		expect(registered.size).toBe(0);
	});
});
