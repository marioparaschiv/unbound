import type { Addon, Resolveable } from '@typings/managers';
import Manager, { ManagerType } from './base';
import { findInReactTree, unitToHex, withoutOpacity } from '@utilities';
import { createPatcher } from '@patcher';
import Storage, { get } from '@api/storage';
import { findByProps } from '@metro';

class Themes extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public module: any;

	constructor() {
		super(ManagerType.Themes);

		this.patcher = createPatcher('themes');
		this.icon = 'ic_paint_brush';
	}

	initialize(mdl: any): void {
		this.module = mdl;

		this.module._Theme = { ...this.module.Theme };
		this.module._RawColor = { ...this.module.RawColor };
		this.module._unsafe_rawColors = { ...this.module.unsafe_rawColors };

		for (const theme of window.UNBOUND_THEMES ?? []) {
			const { manifest, bundle } = theme;
			const parsedId = manifest.id.replace('-', '');

			for (const [key, value] of Object.entries(this.module._Theme)) {
				this.module.Theme[`${manifest.id}-${key}`] = `${parsedId}-${value}`;
			}

			for (const value of Object.values(this.module.Shadow)) {
				for (const [key, shadow] of Object.entries(value)) {
					value[`${parsedId}-${key}`] = shadow;
				}
			}

			for (const value of Object.values(this.module.SemanticColor)) {
				for (const [key, semanticColor] of Object.entries(value)) {
					value[`${parsedId}-${key}`] = semanticColor;
				}
			}

			this.load(bundle, manifest);
		}

		const orig = this.module.default.meta.resolveSemanticColor;
		const self = this;

		this.module.default.meta.resolveSemanticColor = function (theme: string, ref: { [key: symbol]: string; }) {
			const [id, unparsedName] = theme.split('-');

			if (!unparsedName) {
				// id is technically the theme name if there isnt a theme passed
				// because it would now be [0] as the split would just return the full string
				return orig.call(this, id, ref);
			}

			const name = unparsedName === 'darker' ? 'dark' : unparsedName;

			if (!Object.values(self.module.Theme).includes(theme)) {
				return orig.call(this, name, ref);
			}

			const appliedTheme = self.entities.get(id);

			if (!appliedTheme) {
				return orig.call(this, name, ref);
			}

			const { instance } = appliedTheme;
			const key = ref[Object.getOwnPropertySymbols(ref)[0]];
			const themeObject = instance.semantic?.[key];
			const item = themeObject?.[name] ?? themeObject?.['dark'];

			try {
				let color = null;

				if (!item) color = orig.call(this, name, ref);
				if (item?.raw) color = self.module.RawColor[item.raw];
				if (item?.color) {
					if (item.color === 'transparent') {
						return 'rgba(0, 0, 0, 0)';
					}

					color = item.color.replace('transparent', 'rgba(0, 0, 0, 0)');
				}

				if (key === 'CHAT_BACKGROUND' && typeof instance.background?.opacity === 'number') {
					return (color ?? '#000000') + Math.round(instance.background.opacity * 255).toString(16);
				}

				return item?.opacity ? withoutOpacity(color) + unitToHex(item.opacity) : color;;
			} catch(e) {
				console.error('Failed to resolve color:', e);
			}

			return orig.call(this, name, ref);
		};
	}

	override async start(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon || addon.failed || Storage.get('unbound', 'recovery', false)) return;

		try {
			const { instance } = addon;

			if (instance.raw) {
				for (const [key, value] of Object.entries(instance.raw)) {
					this.module.RawColor[key] = value;
					this.module.default.unsafe_rawColors[key] = value;
				}
			}

			if (instance.background) this.applyBackground(addon);
		} catch (e) {
			this.logger.error('Failed to apply theme:', e.message);
		}

		this.emit('applied', addon);
		this.logger.log(`${addon.id} started.`);
	}

	async applyBackground(addon: Addon) {
		// Avoid circular dependency
		const { ReactNative: RN } = await import('@metro/common');
		const { findByName, findByProps } = await import('@metro');
		const { Theme } = await import('@metro/stores');
		const { instance: { background } } = addon;

		const Chat = findByName('MessagesWrapperConnected', { interop: false });
		const { MessagesWrapper } = findByProps('MessagesWrapper');

		this.patcher.after(Chat, 'default', (_, __, res) => {
			const applied = this.settings.get('applied', null);

			if (!applied) return res;

			return (
				<RN.ImageBackground
					blurRadius={typeof background.blur === 'number' ? background.blur : 0}
					style={{ flex: 1, height: '100%' }}
					source={{ uri: typeof background.url === 'string' ? background.url : (background.url[Theme.theme.replace(`${applied}-`, '')] ?? background.url['dark']) }}
				>
					{res}
				</RN.ImageBackground>
			);
		});

		this.patcher.after(MessagesWrapper.prototype, 'render', (_, __, res) => {
			const applied = this.settings.get('applied', null);

			if (!applied) return;

			const Messages = findInReactTree(res, x =>
				'HACK_fixModalInteraction' in x.props
				&& x.props?.style
			);

			if (Messages) {
				Messages.props.style = [Messages.props.style, { backgroundColor: '#00000000' }];
			}
		});
	}

	override toggle(entity: Resolveable): void {
		const addon = this.resolve(entity);
		if (!addon) return;

		const enabled = this.isEnabled(addon.id);

		if (!enabled) {
			this.enable(addon);
		} else {
			this.disable(addon);
		}

		this.emit('toggle');
	}

	override async enable(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set('applied', addon.id);

			if (!addon.started) this.start(addon);

			const { findByProps } = await import('@metro');
			const { Theme } = await import('@metro/stores');
			const { updateTheme } = findByProps('updateTheme');

            updateTheme(`${addon.id.replace('-', '.')}-${Theme.theme.replace(`${addon.id}-`, '')}`);
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

			this.module.RawColor = { ...this.module._RawColor };
			this.module.unsafe_rawColors = { ...this.module._unsafe_rawColors };

			const { findByProps } = await import('@metro');
			const { Theme } = await import('@metro/stores');
			const { updateTheme } = findByProps('updateTheme');

			updateTheme(Theme.theme.replace(`${addon.id}-`, ''));
		} catch (e) {
			this.logger.error(`Failed to stop ${addon.data.id}:`, e.message);
		}
	}

	override isEnabled(id: string): boolean {
		return this.settings.get('applied', null) === id;
	}

	override handleBundle(bundle: string): any {
		return typeof bundle === 'object' ? bundle : JSON.parse(bundle);
	}
}

export default new Themes();