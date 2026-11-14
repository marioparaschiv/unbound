import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { Discord } from '@unbound-app/api/metro/components';
import type { AnyProps } from '@unbound-app/api/metro';
import { assets, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import type { ReactNode } from 'react';

type NotificationsProps = { hasNameplate?: boolean };

const Navigation = metro.findByProps('getRootNavigationRef', { lazy: true });
const GuildActions = metro.findByProps('transitionToGuild', { lazy: true });

function Shortcuts({
	props,
	notification,
}: {
	props: NotificationsProps | undefined;
	notification: ReactNode;
}) {
	const variant = props?.hasNameplate ? 'secondary-overlay' : 'tertiary';

	return (
		<>
			{settings.showFavorites ? (
				<Discord.IconButton
					size='sm'
					variant={variant}
					icon={assets.getIdByName('StarIcon')}
					accessibilityLabel={messages.FAVORITES}
					onPress={() => GuildActions?.transitionToGuild('@favorites')}
				/>
			) : null}
			{notification}
			{settings.showSettings ? (
				<Discord.IconButton
					size='sm'
					variant={variant}
					icon={assets.getIdByName('SettingsIcon')}
					accessibilityLabel={messages.SETTINGS}
					onPress={() => Navigation?.getRootNavigationRef().navigate('settings')}
				/>
			) : null}
		</>
	);
}

/**
 * @description Adds Favorites and Settings buttons beside the You bar's notifications button, by patching `YouBarNotificationsButton`.
 * @returns A function that stops waiting for the module when it has not loaded yet.
 */
export function patchYouBar(): () => void {
	return metro.onModuleLoaded(
		metro.filters.byFilePath(
			'modules/main_tabs_v2/native/you_bar/YouBarNotificationsButton.tsx',
		),
		(module: AnyProps) => {
			const render = findRenderTarget(module);

			if (!render) {
				logger.warn(
					'You bar shortcuts skipped: YouBarNotificationsButton is not a component.',
				);

				return;
			}

			patcher.after(render.holder, render.key, ({ args: [props], result }) =>
				result == null ? (
					result
				) : (
					<Shortcuts
						props={props as NotificationsProps | undefined}
						notification={result}
					/>
				),
			);
		},
		{ interop: false },
	);
}

export default patchYouBar;
