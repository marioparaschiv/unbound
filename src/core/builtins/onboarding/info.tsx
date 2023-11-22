import { Redesign } from '@metro/components';
import { ReactNative as RN } from '@metro/common';
import Plugins from '@ui/settings/plugins';
import useStyles from './styles';

import { on, set } from '@api/storage';
import { Linking } from '@metro/actions';
import { Invite, Links } from '@constants';
import { Strings } from '@api/i18n';
import type { Dispatch, SetStateAction } from 'react';

type CallbackProps = {
	show: Fn,
	hide: Fn,
	next: Fn,
	contentId: string,
	setContent: Dispatch<SetStateAction<{ id: string; instance: any; }>>,
	styles: ReturnType<typeof useStyles>
};

type Item = {
	title: string;
	subtitle: string;
	buttons: {
		text: string;
		icon: string;
		iconPosition?: 'start' | 'end';
		onPress?: Fn;
		variant?: string;
	}[]
	callback({ show, hide, next, setContent, contentId, styles }: CallbackProps): any;
}

function showPluginsPage(setContent: Dispatch<SetStateAction<{ id: string; instance: any }>>, styles: Record<string, any>) {
	setContent({
		id: 'plugins',
		instance: <RN.SafeAreaView style={[{
			width: '100%',
			height: '100%',
			position: 'absolute',
			top: 0,
			bottom: 0,
			left: 0,
			right: 0
		}, styles.page]}>
			<Redesign.Navigator
				initialRouteName='PLUGINS_ONBOARDING'
				screens={{
					PLUGINS_ONBOARDING: {
						render: () => <Plugins headerRightMargin />
					}
				}}
			/>
		</RN.SafeAreaView>
	});
}

export default [
	{
		get title() {
			return Strings.UNBOUND_WELCOME_TITLE;
		},

		get subtitle() {
			return Strings.UNBOUND_WELCOME_SUBTITLE;
		},

		buttons: [{
			get text() {
				return Strings.GET_STARTED;
			},

			icon: 'feature_star'
		}],

		callback({ next }) {
			next();
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_INSTALL_TITLE;
		},

		get subtitle() {
			return Strings.UNBOUND_ONBOARDING_INSTALL_SUBTITLE;
		},

		buttons: [{
			get text() {
				return Strings.CONTINUE;
			},

			icon: 'PlusSmallIcon'
		}],

		callback({ show, hide, next, setContent, styles }) {
			hide();

			showPluginsPage(setContent, styles);

			setTimeout(() => {
				show();
				setTimeout(() => next());
			}, 1000);
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_PLUS_TITLE;
		},

		get subtitle() {
			return Strings.UNBOUND_ONBOARDING_PLUS_SUBTITLE;
		},

		buttons: [{
			get text() {
				return Strings.CONTINUE;
			},

			icon: 'ic_double_down_arrow'
		}],

		callback({ next }) {
			next();
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_PASTE_TITLE;
		},

		get subtitle() {
			return Strings.UNBOUND_ONBOARDING_PASTE_SUBTITLE;
		},

		buttons: [{
			get text() {
				return Strings.CONTINUE;
			},

			icon: 'ClipboardListIcon'
		}],

		callback({ next, setContent, styles, contentId }) {
			next();
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_LETS_TRY_TITLE;
		},

		subtitle: null,

		buttons: [{
			get text() {
				return Strings.OKAY + '!';
			},

			icon: 'arrow',
			iconPosition: 'end'
		}],

		callback({ hide, show, next, contentId, setContent, styles }) {
			// Display the plugins page if it isn't currently showing
			// This can happen if the user restarts the app during Onboarding
			if (contentId !== 'plugins') showPluginsPage(setContent, styles);

			set('unbound', 'onboarding.install', true);
			hide();

			on('changed', ({ key, value }) => {
				if (key === 'onboarding.install' && !value) {
					setTimeout(() => {
						show();
						next();
					}, 500);
				}
			});
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_INSTALLED_TITLE;
		},

		get subtitle() {
			return Strings.UNBOUND_ONBOARDING_INSTALLED_SUBTITLE;
		},

		buttons: [{
			get text() {
				return Strings.CONTINUE;
			},

			icon: 'ic_sparkle'
		}],

		callback({ next }) {
			next();
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_PROTOCOLS_TITLE;
		},

		get subtitle() {
			return Strings.UNBOUND_ONBOARDING_PROTOCOLS_SUBTITLE;
		},

		buttons: [
			{
				get text() {
					return Strings.UNBOUND_DOCUMENTATION;
				},

				// TO-DO: Update this to link to the correct page once it's implemented in the docs
				onPress: () => Linking.openURL(Links.Docs),
				icon: 'BookCheckIcon',
				variant: 'primary-alt',
			},
			{
				get text() {
					return Strings.CONTINUE;
				},

				icon: 'ic_activity_24px',
			}
		],

		callback({ next, setContent }) {
			setContent({ id: '', instance: null });
			next();
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_JOIN_TITLE;
		},

		get subtitle() {
			return Strings.UNBOUND_ONBOARDING_JOIN_SUBTITLE;
		},

		buttons: [
			{
				get text() {
					return Strings.UNBOUND_JOIN_SERVER;
				},

				icon: 'add',
				onPress: () => Linking.openDeeplink(`https://discord.gg/${Invite}`)
			},
			{
				get text() {
					return Strings.MAYBE_LATER;
				},

				icon: 'StarIcon',
				variant: 'primary-alt'
			}
		],
		callback({ next }) {
			next();
		}
	},
	{
		get title() {
			return Strings.UNBOUND_ONBOARDING_FINISH_TITLE;
		},

		subtitle: null,

		buttons: [{
			get text() {
				return Strings.FINISH;
			},

			icon: 'Check'
		}],

		callback({ next }) {
			next();
		}
	}
] satisfies Item[];