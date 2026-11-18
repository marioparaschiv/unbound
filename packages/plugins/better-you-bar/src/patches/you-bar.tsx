import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { Discord } from '@unbound-app/api/metro/components';
import type { AnyProps } from '@unbound-app/api/metro';
import { assets, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { Children, cloneElement, isValidElement, type ComponentType, type ReactNode } from 'react';

type NotificationsProps = { hasNameplate?: boolean };

type ShortcutProps = {
	iconName: 'StarIcon' | 'SettingsIcon';
	label: string;
	variant: string;
	onPress: () => void;
};

type YouBarButtonModule = {
	YouBarButtonContainer?: ComponentType<{ children?: ReactNode }>;
	YouBarButtonIcon?: ComponentType<{ icon: unknown }>;
};

const Navigation = metro.findByProps('getRootNavigationRef', { lazy: true });
const GuildActions = metro.findByProps('transitionToGuild', { lazy: true });
const YouBarButton: YouBarButtonModule | undefined = metro.findByFilePath(
	'modules/main_tabs_v2/native/you_bar/YouBarButton.tsx',
	{ lazy: true },
);
const Icons = metro.findByProps('StarIcon', 'SettingsIcon', 'BellIcon', { lazy: true });

/**
 * @description Reads the variant of Discord's notifications button, so the added buttons match it.
 * @param notification The rendered notifications button.
 * @returns Its `IconButton` variant, if it has one.
 */
export function buttonVariant(notification: ReactNode): string | undefined {
	if (!isValidElement<{ children?: ReactNode }>(notification)) return;

	const button = notification.props.children;

	return isValidElement<{ variant?: unknown }>(button) && typeof button.props.variant === 'string'
		? button.props.variant
		: undefined;
}

type IconProps = { icon?: unknown };
type ChildrenProps = { children?: ReactNode };

function scaledBellIcon(node: ReactNode): ReactNode {
	if (!isValidElement<IconProps>(node) || node.type !== YouBarButton?.YouBarButtonIcon)
		return node;

	return Icons?.BellIcon ? cloneElement(node, { icon: Icons.BellIcon }) : node;
}

/**
 * @description Gives Discord's notifications button the same icon sizing as the added buttons: Discord passes a bell
 * fixed at 18 points, which ignores Display Zoom, while the icon component it takes otherwise scales with it.
 * @param notification The rendered notifications button.
 * @returns The button with its bell icon swapped, or the button as it was when Discord changed its shape.
 */
export function scalingBell(notification: ReactNode): ReactNode {
	if (!isValidElement<ChildrenProps>(notification)) return notification;

	const button = notification.props.children;

	if (!isValidElement<{ icon?: ReactNode }>(button)) return notification;

	const { icon } = button.props;
	const swapped = isValidElement<ChildrenProps>(icon)
		? cloneElement(icon, {}, ...Children.toArray(icon.props.children).map(scaledBellIcon))
		: scaledBellIcon(icon);

	return cloneElement(notification, {}, cloneElement(button, { icon: swapped }));
}

function ShortcutButton({ iconName, label, variant, onPress }: ShortcutProps) {
	const Container = YouBarButton?.YouBarButtonContainer;
	const ButtonIcon = YouBarButton?.YouBarButtonIcon;
	const icon = Icons?.[iconName];
	const button = (
		<Discord.IconButton
			size='sm'
			variant={variant}
			icon={ButtonIcon && icon ? <ButtonIcon icon={icon} /> : assets.getIdByName(iconName)}
			accessibilityLabel={label}
			onPress={onPress}
		/>
	);

	return Container && ButtonIcon && icon ? <Container>{button}</Container> : button;
}

function Shortcuts({
	props,
	notification,
}: {
	props: NotificationsProps | undefined;
	notification: ReactNode;
}) {
	const variant =
		buttonVariant(notification) ?? (props?.hasNameplate ? 'secondary-overlay' : 'tertiary');

	return (
		<>
			{settings.showFavorites ? (
				<ShortcutButton
					iconName='StarIcon'
					label={messages.FAVORITES}
					variant={variant}
					onPress={() => GuildActions?.transitionToGuild('@favorites')}
				/>
			) : null}
			{scalingBell(notification)}
			{settings.showSettings ? (
				<ShortcutButton
					iconName='SettingsIcon'
					label={messages.SETTINGS}
					variant={variant}
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
