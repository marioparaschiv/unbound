import type { Component, ComponentClass } from 'react';

import { deviceScript } from './device-script';
import { Type, type Static } from '@unbound-app/contracts/schema';

export const settingsProbeSchema = Type.Object({
	rendered: Type.Boolean(),
	texts: Type.Number(),
	error: Type.String(),
});

export type SettingsProbe = Static<typeof settingsProbeSchema>;

type MatrixGlobal = typeof globalThis & {
	__matrixSettingsProbe?: SettingsProbeState;
};

type SettingsProbeState = {
	rendered: boolean;
	/** Set once the screen closed and React unmounted the probe. */
	closed: boolean;
	error: string;
	boundary: { _reactInternals?: ReactFiber } | null;
};

type ReactFiber = {
	tag: number;
	type: unknown;
	memoizedProps?: { children?: unknown };
	child?: ReactFiber | null;
	sibling?: ReactFiber | null;
};

function openSettingsScreen(id: string) {
	const entity = unbound.plugins.get(id) as DeviceAddon | undefined;
	const SettingsPanel = entity?.SettingsPanel;

	if (!entity || !SettingsPanel) return 'none';

	const { React } = unbound.metro.common;
	const probe: SettingsProbeState = { rendered: false, closed: false, error: '', boundary: null };
	type BoundaryInstance = {
		props: { children?: unknown };
		state: { failed: boolean };
	};
	const Boundary = function (this: BoundaryInstance, props: BoundaryInstance['props']) {
		Reflect.apply(React.Component, this, [props]);
		this.state = { failed: false };
	} as unknown as ComponentClass & { getDerivedStateFromError?: () => object };

	(globalThis as MatrixGlobal).__matrixSettingsProbe = probe;
	Boundary.getDerivedStateFromError = () => ({ failed: true });
	Boundary.prototype = Object.assign(Object.create(React.Component.prototype) as Component, {
		constructor: Boundary,
		componentDidCatch(error: unknown) {
			probe.error = String(
				error && (error as Error).message ? (error as Error).message : error,
			);
		},
		componentDidMount(this: SettingsProbeState['boundary']) {
			probe.boundary = this;
		},
		componentWillUnmount() {
			probe.closed = true;
		},
		render(this: BoundaryInstance) {
			return this.state.failed ? null : this.props.children;
		},
	});

	const Panel = () => {
		probe.rendered = true;

		return React.createElement(SettingsPanel);
	};

	unbound.metro
		.findByProps('getRootNavigationRef')
		.getRootNavigationRef()
		.navigate('settings', {
			screen: 'UNBOUND_CUSTOM',
			params: {
				title: entity.manifest.name,
				render: () => React.createElement(Boundary, null, React.createElement(Panel)),
			},
		});

	return 'opened';
}

/**
 * @description Opens a plugin's settings panel in Unbound's custom settings screen, the way its card's cog does, inside a probe that records whether the panel rendered and the error it threw.
 * @param id The plugin's id.
 * @returns A script whose result is `opened`, or `none` when the plugin is not running or has no panel.
 */
export function settingsScreenScript(id: string): string {
	return deviceScript(openSettingsScreen, id);
}

/**
 * @description Reads what the settings probe recorded for the panel on screen, counting the text the panel rendered by walking React's tree below the probe.
 * @returns A script whose result is the probe as JSON.
 */
function readSettingsProbe() {
	const probe = (globalThis as MatrixGlobal).__matrixSettingsProbe;

	if (!probe)
		return JSON.stringify({
			rendered: false,
			texts: 0,
			error: 'the settings screen did not open',
		});

	let texts = 0;
	const root = probe.boundary?._reactInternals;
	const stack = root?.child ? [root.child] : [];

	while (stack.length) {
		const fiber = stack.pop()!;
		const children = fiber.memoizedProps?.children;

		if (
			fiber.tag === 6 ||
			(typeof fiber.type === 'string' &&
				(typeof children === 'string' || typeof children === 'number'))
		) {
			texts++;
		}

		if (fiber.sibling) stack.push(fiber.sibling);
		if (fiber.child) stack.push(fiber.child);
	}

	return JSON.stringify({ rendered: probe.rendered, texts, error: probe.error });
}

export function settingsProbeScript(): string {
	return deviceScript(readSettingsProbe);
}

/**
 * @description Leaves the screen the matrix opened, back to the chat.
 * @returns A script whose result is `closed`.
 */
function closeScreen() {
	const navigation = unbound.metro.findByProps('getRootNavigationRef').getRootNavigationRef();

	if (navigation.canGoBack()) navigation.goBack();

	return 'closed';
}

export function closeScreenScript(): string {
	return deviceScript(closeScreen);
}

function readSettingsClosed() {
	const probe = (globalThis as MatrixGlobal).__matrixSettingsProbe;

	return !probe || probe.closed ? 'closed' : 'open';
}

/**
 * @description Reads whether the settings screen the matrix opened has closed, which React reports by unmounting the probe.
 * @returns A script whose result is `closed` or `open`.
 */
export function settingsClosedScript(): string {
	return deviceScript(readSettingsClosed);
}
