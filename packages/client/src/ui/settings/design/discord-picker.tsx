import { createElement, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import noop from '@unbound-app/utils/noop';
import { View } from 'react-native';

import Empty from '~/ui/components/empty-state';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import { DEFAULT_THEME_ID, defaultThemeSwatch } from './default-theme';
import { NavigationCore, type HeaderOptions } from './navigation';
import { ReportPicker, type PickerKind } from './picker-report';
import useCarouselAuthors from './use-carousel-authors';
import useHideNitroBadge from './use-hide-nitro-badge';
import { loadThemePicker } from './appearance-picker';
import usePreviewedAddon from './use-previewed-addon';
import useApplyOnSelect from './use-apply-on-select';
import useSaveIntercept from './use-save-intercept';
import useDiscordTheme from './use-discord-theme';
import useStableAddons from './use-stable-addons';
import useStyles from './discord-picker.style';
import { pickerThemeOf } from './picker-theme';
import useApplyAddon from './use-apply-addon';
import PickerActions from './picker-actions';

type DiscordPickerProps = {
	kind: PickerKind;
};

/**
 * @description Discord's own App Theme picker, fed Unbound's themes or icon packs: its live preview and
 * carousel, saving on selection, with saving routed to the addon instead of Discord's theme, plus the
 * addon actions in its bottom corners. The header it sets goes to the page through {@link ReportPicker},
 * since Themes and Icons share one stack header.
 */
function DiscordPicker({ kind }: DiscordPickerProps) {
	const styles = useStyles();
	const navigation = Discord.useNavigation();
	const report = useContext(ReportPicker);
	const addons = useStableAddons(kind);
	const { applied, revision, apply, clear } = useApplyAddon(kind, addons);
	// Themes lead with "Default", Discord's own theme, which clears the applied one.
	const clearable = kind === 'theme';
	const discordTheme = useDiscordTheme();
	const themes = useMemo(
		() => [
			...(clearable ? [defaultThemeSwatch(discordTheme)] : []),
			...addons.map((addon, index) => pickerThemeOf(addon, index)),
		],
		[addons, clearable, discordTheme],
	);
	const connected = useMemo(() => loadThemePicker(), []);
	const addon = usePreviewedAddon(
		addons,
		addons.find((entry) => entry.id === applied) ?? (clearable ? undefined : addons[0]),
	);
	const reporting = useMemo(
		() => ({
			...navigation,
			setOptions: (options: HeaderOptions) => report(kind, options),
		}),
		[navigation, report, kind],
	);

	const ids = useMemo(() => themes.map((theme) => theme.unboundAddonId), [themes]);
	// The swatch last applied from this picker; one in view that differs was swiped to and not yet applied.
	const settled = useRef(applied ?? (clearable ? DEFAULT_THEME_ID : ''));
	const select = useCallback(
		(id: string) => {
			settled.current = id;

			const picked = addons.find((entry) => entry.id === id);

			if (picked) {
				apply(picked);
			} else if (id === DEFAULT_THEME_ID && clearable) {
				clear();
			}
		},
		[addons, apply, clear, clearable],
	);

	// On close, apply the swatch in view if the carousel never settled on it. A page frozen in the background keeps
	// a stale one in view, which must not undo a theme applied elsewhere.
	const closing = useRef(() => {});

	useEffect(() => {
		closing.current = () => {
			const id = addon?.id ?? (clearable ? DEFAULT_THEME_ID : '');

			if (id !== settled.current) {
				select(id);
			}
		};
	});
	useEffect(() => () => closing.current(), []);
	useApplyOnSelect(ids, select);
	useCarouselAuthors(addons);
	useHideNitroBadge(ids);
	useSaveIntercept(ids);

	if (!connected) {
		return <Empty>{messages.UNBOUND_EMPTY_RESULTS}</Empty>;
	}

	// Called inline so its hooks run as this component's: it only resolves Discord's inner `ThemePicker`.
	const screen = connected({ themeSelector: 'nitro' });

	return (
		<View style={styles.page}>
			<NavigationCore.NavigationContext.Provider value={reporting}>
				{createElement(screen.type, {
					...screen.props,
					// The picker reads `defaultIndex` once and saves its swatch when the page closes, so one applied
					// elsewhere remounts it on that swatch rather than being saved over.
					key: revision,
					mobileThemes: themes,
					defaultIndex: Math.max(
						0,
						themes.findIndex((theme) => theme.unboundAddonId === applied),
					),
					isPreview: false,
					isSynced: false,
					mode: null,
					// Without its Done button the picker saves each swatch as it is selected.
					hasSaveButton: false,
					hasOnyxNux: false,
					headerTitle: messages.UNBOUND_DESIGN,
					onSaveTheme: noop,
				})}
			</NavigationCore.NavigationContext.Provider>
			<PickerActions kind={kind} addon={addon} />
		</View>
	);
}

export default DiscordPicker;
