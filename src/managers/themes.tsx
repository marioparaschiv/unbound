import { findInReactTree, unitToHex, withoutOpacity } from '@utilities';
import type { Addon, Resolveable } from '@typings/managers';
import Manager, { ManagerType } from './base';
import { createPatcher } from '@patcher';
import Storage from '@api/storage';

class Themes extends Manager {
	public patcher: ReturnType<typeof createPatcher>;
	public extension: string = 'json';
	public module: any;
	private updateTheme: Fn = null;

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

		// const orig = this.module.default.internal.resolveSemanticColor;
		// const self = this;

		// this.module.default.internal.resolveSemanticColor = function (theme: string, ref: { [key: symbol]: string; }) {
		// 	const [id, unparsedName] = theme.split('-');

		// 	if (!unparsedName) {
		// 		// id is technically the theme name if there isnt a theme passed
		// 		// because it would now be [0] as the split would just return the full string
		// 		return orig.call(this, id, ref);
		// 	}

		// 	const name = unparsedName === 'darker' ? 'dark' : unparsedName;

		// 	if (!Object.values(self.module.Theme).includes(theme)) {
		// 		return orig.call(this, name, ref);
		// 	}

		// 	const appliedTheme = self.entities.get(id);

		// 	if (!appliedTheme) {
		// 		return orig.call(this, name, ref);
		// 	}

		// 	const { instance } = appliedTheme;
		// 	const key = ref[Object.getOwnPropertySymbols(ref)[0]];
		// 	const themeObject = instance.semantic?.[key];
		// 	const item = themeObject?.[name] ?? themeObject?.['dark'];

		// 	try {
		// 		let color = null;

		// 		if (!item) color = orig.call(this, name, ref);
		// 		if (item?.raw) color = self.module.RawColor[item.raw];
		// 		if (item?.color) {
		// 			if (item.color === 'transparent') {
		// 				return 'rgba(0, 0, 0, 0)';
		// 			}

		// 			color = item.color.replace('transparent', 'rgba(0, 0, 0, 0)');
		// 		}

		// 		if (key === 'CHAT_BACKGROUND' && typeof instance.background?.opacity === 'number') {
		// 			return (color ?? '#000000') + Math.round(instance.background.opacity * 255).toString(16);
		// 		}

		// 		return item?.opacity ? withoutOpacity(color) + unitToHex(item.opacity) : color;
		// 	} catch (e) {
		// 		console.error('Failed to resolve color:', e);
		// 	}

		// 	return orig.call(this, name, ref);
		// };

		// Discord sets the theme to darker if it isn't in the theme object
		// When this check is ran, our themes haven't initialized yet.
		// Hence, let's update our theme back to the correct one below.
		// const currentTheme = this.settings.get('applied', null);

		// if (!currentTheme) return;

		// if (typeof this.updateTheme !== 'function') {
		// 	const { findByProps } = await import('@metro');
		// 	this.updateTheme = findByProps('updateTheme').updateTheme;
		// }

		// const { Theme } = await import('@metro/stores');
		// this.updateTheme(`${currentTheme.replace('-', '.')}-${Theme.theme.replace(/.*-/g, '')}`);
	}

	override async start(entity: Resolveable): Promise<void> {
		const addon = this.resolve(entity);
		if (!addon || addon.failed || Storage.get('unbound', 'recovery', false)) return;

		try {
			const { instance, id } = addon;

			if (instance.raw) {
				for (const [key, value] of Object.entries(instance.raw)) {
					this.module.RawColor[key] = value;
					this.module.default.unsafe_rawColors[key] = value;
				}
			}

			// for (const [key, value] of Object.entries(this.module._Theme)) {
			// 	this.module.Theme[key] = `${parsedId}-${value}`;
			// }

			// for (const value of Object.values(this.module.Shadow)) {
			// 	for (const [key, shadow] of Object.entries(value)) {
			// 		value[`${parsedId}-${key}`] = shadow;
			// 	}
			// }

			// for (const value of Object.values(this.module.SemanticColor)) {
			// 	for (const [key, semanticColor] of Object.entries(value)) {
			// 		value[`${parsedId}-${key}`] = semanticColor;
			// 	}
			// }

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
					source={{ uri: background.url }}
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

	override isEnabled(id: string): boolean {
		return this.settings.get('applied', null) === id;
	}

	override handleBundle(bundle: string): any {
		return typeof bundle === 'object' ? bundle : JSON.parse(bundle);
	}
}

export default new Themes();