import { findInReactTree, unitToHex, withoutOpacity } from '@utilities';
import type { Addon, Resolveable } from '@typings/managers';
import Manager, { ManagerType } from './base';
import { createPatcher } from '@patcher';
import Storage from '@api/storage';

const PREVIEW_TOKEN = 'primary-600';

class Themes extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public module: any;
	public currentTheme = null;

	constructor() {
		super(ManagerType.Themes);

		this.patcher = createPatcher('themes');
		this.icon = 'ic_paint_brush';
	}

	async initialize(mdl: any) {
		this.module = mdl;

		for (const theme of window.UNBOUND_THEMES ?? []) {
			const { manifest, bundle } = theme;

			this.load(bundle, manifest);
		}

		this.module._RawColor = { ...this.module.RawColor };

		const self = this;

		const { findStore, findByProps } = await import('@metro');
		const ThemeStore = findStore('Theme');
		const Coloring = findByProps('ColorDetails', 'Color', { lazy: true });

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

		const originalColor = Coloring.ColorDetails[PREVIEW_TOKEN];
		Object.defineProperty(Coloring.ColorDetails, PREVIEW_TOKEN, {
				configurable: true,
				enumerable: true,
				get: () => {
						const theme = self.entities.get(self.currentTheme);

						if (theme) {
							const color = theme.instance.raw?.[PREVIEW_TOKEN.toUpperCase().replace(/-/g, '_')];
							return color ? { hex: color } : originalColor;
						}

						return originalColor;
				}
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
	}

	parseColor(item: Record<string, any>, theme: string) {
		if (!item?.value) return item;
		if (item?.type === 'raw') {
			this.currentTheme = theme;
			return this.module.RawColor[item.value];
		};
		if (item?.type === 'color') return item.value.replace('transparent', 'rgba(0, 0, 0, 0)');
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
		const { findByName, findByProps, findStore } = await import('@metro');

		const Chat = findByName('MessagesWrapperConnected', { interop: false });
		const { MessagesWrapper } = findByProps('MessagesWrapper');
		const ThemeStore = findStore('Theme');

		this.patcher.after(Chat, 'default', (_, __, res) => {
			const theme = this.entities.get(ThemeStore.theme);

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
			const theme = this.entities.get(ThemeStore.theme);

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
		const { findByProps } = await import('@metro');
		const ThemeConverter = findByProps('convertThemesToAnimatedThemes', { lazy: true });
		const ThemePresets = findByProps('getMobileThemesPresets', { lazy: true });
		const ThemeIndex = findByProps('getUserThemeIndex', 'handleSaveTheme', { lazy: true });
		const Can = findByProps('canUseClientThemes', { lazy: true });

		// Ensure the user can use client themes
		this.patcher.instead(Can, 'canUseClientThemes', () => true);

		// Add our themes to the list of available themes
		this.patcher.after(ThemePresets, 'getMobileThemesPresets', (_, __, res) => {
			this.entities.forEach(value => {
				if (res.find(x => x.theme === value.id)) return;

				this.currentTheme = value.id;
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
							token: PREVIEW_TOKEN,
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

		this.patcher.after(ThemeIndex, 'getUserThemeIndex', (_, args: [any, boolean, any[], string], res) => {
			// Fix for finding the custom theme, as it's now always either "darker" or "light" it won't return the index of the real theme
			// So therefore we try to find the theme by the angle property first, if it fails we use the original value
			const index = args[2].findIndex(x => x.angle === args[3]);
			return index === -1 ? res : index;
		});
	}

	override async enable(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set('applied', addon.id);

			if (!addon.started) this.start(addon);
		} catch (e) {
			this.logger.error(`Failed to enable ${addon.data.id}:`, e.message);
		}
	}

	override async disable(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set('applied', null);

			if (addon.started) this.stop(addon);
		} catch (e) {
			this.logger.error(`Failed to stop ${addon.data.id}:`, e.message);
		}
	}

	override isEnabled(id: string): boolean {
		return true;
	}

	override handleBundle(bundle: string): any {
		return typeof bundle === 'object' ? bundle : JSON.parse(bundle);
	}
}

export default new Themes();