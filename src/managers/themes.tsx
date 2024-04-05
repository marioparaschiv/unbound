import { findInReactTree, unitToHex, withoutOpacity } from '@utilities';
import type { Resolveable } from '@typings/managers';
import Manager, { ManagerType } from './base';
import { createPatcher } from '@patcher';
import Storage from '@api/storage';

class Themes extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public module: any;
	private currentTheme = null;

	constructor() {
		super(ManagerType.Themes);

		this.patcher = createPatcher('themes');
		this.icon = 'ic_paint_brush';
	}

	async initialize(mdl: any) {
		this.module = mdl;
		this.module._Theme = { ...this.module.Theme };
		this.module._RawColor = { ...this.module.RawColor };

		for (const theme of window.UNBOUND_THEMES ?? []) {
			const { manifest, bundle } = theme;

			this.load(bundle, manifest);
		}

		const self = this;

		const { findStore } = await import('@metro');
		const ThemeStore = findStore('Theme');

		this.currentTheme = ThemeStore.theme;

		Object.keys(this.module.RawColor).forEach(key => {
			Object.defineProperty(self.module.RawColor, key, {
				configurable: true,
				enumerable: true,
				get: () => {
					const theme = self.entities.get(self.currentTheme);

					if (theme) {
						return theme.instance.raw?.[key] ?? self.module._RawColor[key];
					}

					return self.module._RawColor[key];
				}
			});
		});

		const orig = this.module.default.internal.resolveSemanticColor;

		this.module.default.internal.resolveSemanticColor = function (theme: string, ref: { [key: symbol]: string; }) {
			if (!Object.values(self.module.Theme).includes(theme)) {
				return orig.call(this, theme, ref);
			}

			const appliedTheme = self.entities.get(theme);

			if (!appliedTheme) {
				return orig.call(this, theme, ref);
			}

			const { instance } = appliedTheme;
			const key = ref[Object.getOwnPropertySymbols(ref)[0]];
			const item = instance.semantic?.[key];

			try {
				let color = null;

				if (!item) color = orig.call(this, 'dark', ref);
				else color = self.parseColor(item, theme);

				if (key === 'CHAT_BACKGROUND' && typeof instance.background?.opacity === 'number') {
					return (color ?? '#000000') + Math.round(instance.background.opacity * 255).toString(16);
				}

				return item?.opacity ? withoutOpacity(color) + unitToHex(item.opacity) : color;
			} catch (e) {
				console.error('Failed to resolve color:', e);
			}

			return orig.call(this, 'dark', ref);
		};

		this.applyBackground();
		this.applyPatches();
		this.applyStoragePatch();
		this.initialized = true;
	}

	parseColor(item: Record<string, any>, theme: string) {
		if (!item?.value) {
			return item;
		}

		if (item?.type === 'raw') {
			this.currentTheme = theme;
			return this.module.RawColor[item.value];
		};

		if (item?.type === 'color') {
			return item.value.replace('transparent', 'rgba(0, 0, 0, 0)');
		}
	}

	override async start(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon || addon.failed || Storage.get('unbound', 'recovery', false)) return;

		try {
			const { id } = addon;

			this.module.Theme[id.toUpperCase().replace('.', '_')] = id;

			Object.keys(this.module.Shadow).forEach(key => {
				this.module.Shadow[key][id] = this.module.Shadow[key]['darker'];
			});

			Object.keys(this.module.SemanticColor).forEach(key => {
				this.module.SemanticColor[key][id] = this.module.SemanticColor[key]['darker'];
			});
		} catch (e) {
			this.logger.error('Failed to apply theme:', e.message);
		}

		this.emit('applied', addon);
		this.logger.log(`${addon.id} started.`);
	}

	async applyBackground() {
		// Avoid circular dependency
		const { ReactNative: RN } = await import('@metro/common');
		const { findByName, fastFindByProps, findStore } = await import('@metro');

		const Chat = findByName('MessagesWrapperConnected', { interop: false });
		const { MessagesWrapper } = fastFindByProps('MessagesWrapper');

		this.patcher.after(Chat, 'default', (_, __, res) => {
			const theme = this.entities.get(this.settings.get('current', null));

			if (!theme || !theme.instance.background) return res;

			const { instance: { background } } = theme;

			return (
				<RN.ImageBackground
					blurRadius={typeof background.blur === 'number' ? background.blur : 0}
					style={{ flex: 1, height: '100%' }}
					source={{ uri: background.url }}
				>
					{res}
				</RN.ImageBackground>
			);
		});

		this.patcher.after(MessagesWrapper.prototype, 'render', (_, __, res) => {
			const theme = this.entities.get(this.settings.get('current', null));

			if (!theme || !theme.instance.background) return res;

			const Messages = findInReactTree(res, x =>
				'HACK_fixModalInteraction' in x.props
				&& x.props?.style
			);

			if (Messages) {
				Messages.props.style = [Messages.props.style, { backgroundColor: '#00000000' }];
			}
		});
	}

	async applyPatches() {
		const { fastFindByProps } = await import('@metro');
		const ThemeIndex = fastFindByProps('getUserThemeIndex', 'handleSaveTheme');
		const ThemeConverter = fastFindByProps('convertThemesToAnimatedThemes');
		const ThemePresets = fastFindByProps('getMobileThemesPresets');
		const Can = fastFindByProps('canUseClientThemes');

		// This one can be lazy because it only needs to be updated when the patch actually runs
		// and the patch only runs when the Theme Picker page is opened.
		const Coloring = fastFindByProps('ColorDetails', 'Color', { lazy: true });

		// Ensure the user can use client themes otherwise our themes would be locked behind Nitro
		this.patcher.instead(Can, 'canUseClientThemes', () => true);

		// Add our themes to the list of available themes
		this.patcher.after(ThemePresets, 'getMobileThemesPresets', (_, __, res) => {
			this.entities.forEach(value => {
				if (res.find(x => x.theme === value.id)) return;

				const color = this.parseColor(value.instance?.semantic['BG_BASE_PRIMARY'], value.id);
				Coloring.ColorDetails[`${value.id}-accent`] = { hex: color };

				res.unshift({
					// Use the dark/light original theme modes depending on the type of the custom theme
					theme: value.instance?.type === 'dark' ? 'darker' : 'light',

					// Provide the id as the "angle" to allow it to be passed through the converter
					// This is because if we define our own props here Discord omits them when converting
					// We also cant put the id as a "token" because Discord tries to parse it to a RawColor and fails
					// Therefore we can do this and parse it later on, providing the real angle of 0 after we use the id
					midpointPercentage: 50,
					angle: value.id,
					colors: [
						{
							token: `${value.id}-accent`,
							stop: 100
						}
					],
					getName() {
						return value.data.name;
					}
				});
			});
		});

		this.patcher.after(ThemeConverter, 'convertThemesToAnimatedThemes', (_, __, res: Record<string, any>[]) => {
			for (const data of res) {
				const theme = this.entities.get(data.angle);

				if (theme) {
					// Uses BG_BASE_PRIMARY as the accent color of the theme
					data.angle = 0;
					data.colors = new Array(5).fill(null).map((_, i) => {
						return {
							hex: this.parseColor(theme.instance.semantic['BG_BASE_PRIMARY'], theme.id) ?? '#313338',
							stop: (i + 1) * 20
						};
					});
				}
			}
		});

		this.patcher.before(ThemeIndex, 'handleSaveTheme', (_, args: any[]) => {
			// Fix for saving the theme when using this approach
			// It would otherwise save as "darker" or "light" because that's the underlying theme
			// Therefore we can use the angle to set the theme id
			// We don't *need* to get the theme from the entities Map, however this is the simplest way to see if the theme is custom or not.
			const theme = this.entities.get(args[0].angle);

			if (theme) {
				args[0].theme = theme.id;
			}

			return args;
		});

		this.patcher.instead(ThemeIndex, 'getUserThemeIndex', (_, args: [any, boolean, any[], string]) => {
			// Fix for finding the custom theme, as it's now always either "darker" or "light" it won't return the index of the real theme
			// So therefore we try to find the theme by the angle property first, if it fails we use the original value ensuring it's not a custom theme
			const customThemeIndex = args[2].findIndex(x => x.angle === args[3]);
			const officialThemeIndex = args[2].findIndex(x => x.theme === args[3] && !this.entities.get(x.angle));
			return customThemeIndex === -1 ? officialThemeIndex : customThemeIndex;
		});
	}

	async applyStoragePatch() {
		const { Theme } = await import('@metro/stores');
		const { fastFindByProps } = await import('@metro');

		// This whole storage patch inspired by @pylixonly's Bunny implementation
		// https://github.com/pyoncord/Pyoncord/blob/082e9b2cf9feeb5d448bab6bf923e0ab31ca3887/src/lib/managers/themes.ts#L260-L318
		const mmkvStorage = fastFindByProps('storage', 'get', 'set', 'parseResolve');

		Theme.addChangeListener(() => {
			if (Theme.theme) {
				const enabled = [...this.entities.keys()].includes(Theme.theme);
				this.settings.set('enabled', enabled);
				enabled && this.settings.set('current', Theme.theme);
			}
		});

		this.patcher.after(mmkvStorage, 'get', (_, [store]: [string], res) => {
			const storeMap = {
				SelectivelySyncedUserSettingsStore() {
					if (!res?._state?.appearance?.settings?.theme) return;
					res._state.appearance.settings.theme = this.settings.get('current', null);
				},

				ThemeStore() {
					if (!res?._state?.theme) return;
					res._state.theme = this.settings.get('current', null);
				}
			};

			if (!this.settings.get('enabled', false) || !(store in storeMap)) return;
			storeMap[store]();
		});

		this.patcher.before(mmkvStorage, 'set', (_, [store, unparsedValue]: [string, any]) => {
			if (!unparsedValue) return;
			const value = JSON.parse(JSON.stringify(unparsedValue));

			const storeMap = {
				SelectivelySyncedUserSettingsStore() {
					if (!value._state?.appearance?.settings?.theme) return;
					value._state.appearance.settings.theme = this.module.Theme.DARKER;
				},

				ThemeStore() {
					if (!value._state?.theme) return;
					const { theme } = value._state;

					if (this.isDiscordTheme(theme)) {
						this.settings.set('current', null);
					} else {
						value._state.theme = this.module.Theme.DARKER;
					}
				}
			};

			if (!(store in storeMap)) return;

			storeMap[store]();
			return [store, value];
		});
	}

	isDiscordTheme(id: string) {
		return Object.values(this.module._Theme).includes(id);
	}

	override isEnabled(id: string): boolean {
		return true;
	}

	override handleBundle(bundle: string): any {
		return typeof bundle === 'object' ? bundle : JSON.parse(bundle);
	}
}

export default new Themes();