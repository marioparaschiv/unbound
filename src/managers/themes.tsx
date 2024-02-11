import { findInReactTree, unitToHex, withoutOpacity } from '@utilities';
import type { Addon, Resolveable } from '@typings/managers';
import Manager, { ManagerType } from './base';
import { createPatcher } from '@patcher';
import Storage from '@api/storage';

class Themes extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public module: any;

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

		Object.keys(this.module.RawColor).forEach(key => {
			Object.defineProperty(self.module.RawColor, key, {
					configurable: true,
					enumerable: true,
					get: () => {
							const theme = self.entities.get(ThemeStore.theme);

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
				else color = self.parseColor(item);

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

	parseColor(item: Record<string, any>) {
		if (!item?.value) return item;
		if (item?.type === 'raw') return this.module.RawColor[item.value];
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

		this.patcher.after(ThemePresets, 'getMobileThemesPresets', (_, __, res) => {
			this.entities.forEach(value => {
				if (res.find(x => x.theme === value.id)) return;

				res.unshift({
					theme: value.id,
					getName() {
						return value.data.name;
					}
				});
			});
		});

		this.patcher.after(ThemeConverter, 'convertThemesToAnimatedThemes', (_, args, res: Record<string, any>[]) => {
			for (const data of res) {
				const theme = this.entities.get(data.theme);

				if (theme) {
					data.colors = new Array(5).fill(null).map((_, i) => {
						return {
							hex: this.module.default.internal.resolveSemanticColor(data.theme, this.module.default.colors.BG_BASE_PRIMARY),
							stop: (i + 1) * 20
						};
					});
				}
			}
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