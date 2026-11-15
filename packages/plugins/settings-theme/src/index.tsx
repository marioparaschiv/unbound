import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';
import { StyleSheet, View } from 'react-native';
import { Children, cloneElement, isValidElement, type ComponentType, type ReactNode } from 'react';

import { withTransparentNavigator } from '~/lib/navigator';

const NAVIGATOR_ID = 'settings-navigator';
const TRANSPARENT = { backgroundColor: 'transparent' };

type CustomThemeStore = { getCustomTheme?(): unknown };
type GradientStore = { getLinearGradient?(): unknown };

function isThemeActive(): boolean {
	const custom = flux.getStore('CustomThemeMobile') as CustomThemeStore | undefined;
	const gradient = flux.getStore('ClientThemesBackground') as GradientStore | undefined;

	return Boolean(custom?.getCustomTheme?.() || gradient?.getLinearGradient?.());
}

type RootProps = { style?: unknown; children?: ReactNode };

function ThemedSettings({ children }: { children: ReactNode }) {
	const useThemeActive = metro.findByFilePath('modules/client_themes/native/useActiveTheme.tsx', {
		interop: false,
	})?.useIsClientThemeOrCustomThemeActive as (() => boolean) | undefined;
	const Gradient = metro.findByFilePath('modules/client_themes/native/ThemedGradient.tsx', {
		interop: false,
	})?.default as ComponentType<{ style?: object }> | undefined;
	const active = useThemeActive?.() ?? false;
	const root = withTransparentNavigator(children, NAVIGATOR_ID);

	if (!active || !Gradient || !isValidElement<RootProps>(root)) return root;

	return cloneElement(
		root,
		{ style: [root.props.style, TRANSPARENT] },
		<View
			key='unbound-theme'
			pointerEvents='none'
			style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
		>
			<Gradient style={{ flex: 1 }} />
		</View>,
		<View
			key='unbound-dim'
			pointerEvents='none'
			style={[
				StyleSheet.absoluteFill,
				{ backgroundColor: `rgba(0,0,0,${settings.dim / 100})` },
			]}
		/>,
		...Children.toArray(root.props.children),
	);
}

type StyledProps = { style?: unknown; contentContainerStyle?: unknown };

function transparentList(result: unknown) {
	if (!isValidElement<StyledProps>(result)) return result;

	return cloneElement(result, {
		style: [result.props.style, TRANSPARENT],
		contentContainerStyle: [result.props.contentContainerStyle, TRANSPARENT],
	});
}

function patchSettingsLists() {
	const lists = metro.findByFilePath('modules/settings/native/renderer/SettingListRenderer.tsx', {
		interop: false,
	});

	if (!lists)
		return logger.warn(
			'Settings theme could not clear page backgrounds: Discord moved SettingsList.',
		);

	for (const name of ['SettingsList', 'SearchableSettingsList']) {
		const target = findRenderTarget(lists, name);

		if (target)
			patcher.after(target.holder, target.key, ({ result }) =>
				isThemeActive() ? transparentList(result) : result,
			);
	}
}

export function start() {
	patchSettingsLists();

	const module = metro.findByFilePath('modules/user_settings/core/native/SettingsNavigator.tsx', {
		interop: false,
	});
	const render = module ? findRenderTarget(module) : null;

	if (!render) {
		logger.warn('Settings theme skipped: Discord moved SettingsNavigator.');

		return;
	}

	patcher.after(render.holder, render.key, ({ result }) =>
		result == null ? result : <ThemedSettings>{result as ReactNode}</ThemedSettings>,
	);
}

export function stop() {
	patcher.unpatchAll();
}
