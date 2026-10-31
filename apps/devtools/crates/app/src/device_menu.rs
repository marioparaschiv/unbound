use gpui::{
	Anchor, AnyElement, Context, Div, Entity, Focusable, FontWeight, MouseButton, SharedString,
	Stateful, Window, anchored, deferred, div, point, prelude::*, px,
};
use unbound_devtools_core::Presets;

use crate::app::Workspace;
use crate::devices::{DeviceChoice, FORM_CONTEXT, MENU_CONTEXT, MenuItem, PresetForm, menu_items};
use crate::input::TextInput;
use crate::widgets::{eyebrow, icon, primary_button, tooltip};
use crate::{assets, theme};

const MENU_WIDTH: f32 = 300.;
const ROW_HEIGHT: f32 = 32.;
const TWO_LINE_ROW_HEIGHT: f32 = 40.;

fn divider() -> Div {
	div().my(px(4.)).h(px(1.)).bg(theme::color(theme::BORDER))
}

fn menu_row(id: SharedString, highlighted: bool, height: f32) -> Stateful<Div> {
	div()
		.id(id)
		.flex()
		.items_center()
		.gap(px(8.))
		.h(px(height))
		.px(px(theme::INSET))
		.rounded(theme::RADIUS_CONTROL)
		.cursor_pointer()
		.when(highlighted, |row| row.bg(theme::color(theme::HOVER)))
		.hover(|row| row.bg(theme::color(theme::HOVER)))
}

fn two_lines(title: String, detail: String) -> Div {
	div()
		.flex_1()
		.min_w_0()
		.flex()
		.flex_col()
		.child(
			div()
				.truncate()
				.text_color(theme::color(theme::TEXT))
				.child(title),
		)
		.child(
			div()
				.truncate()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_MUTED))
				.child(detail),
		)
}

fn field(label: &'static str, input: &Entity<TextInput>, focused: bool) -> Div {
	div()
		.flex()
		.flex_col()
		.gap(px(4.))
		.child(
			div()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_SECONDARY))
				.child(label),
		)
		.child(
			div()
				.flex()
				.items_center()
				.h(px(28.))
				.px(px(8.))
				.rounded(theme::RADIUS_CONTROL)
				.bg(theme::color(theme::APP))
				.border_1()
				.border_color(if focused {
					theme::alpha(theme::ACCENT, 0.6)
				} else {
					theme::color(theme::BORDER)
				})
				.child(input.clone()),
		)
}

impl Workspace {
	pub fn render_connect(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let open = self.device_menu.is_some();
		let target = match self.default_choice() {
			DeviceChoice::Preset(name) => Some(name),
			DeviceChoice::Default => None,
		};
		let label = div()
			.flex()
			.gap(px(4.))
			.map(|label| match (self.connecting, target) {
				(true, _) => label.child("Connecting"),
				(false, None) => label.child("Connect device"),
				(false, Some(name)) => label
					.child("Connect")
					.child(div().text_color(theme::color(theme::TEXT)).child(name)),
			});
		let main = div()
			.id("connect")
			.flex()
			.items_center()
			.gap(px(6.))
			.h_full()
			.pl(px(8.))
			.pr(px(6.))
			.cursor_pointer()
			.hover(|part| part.bg(theme::color(theme::HOVER)))
			.child(icon(assets::PLUG, theme::ICON, theme::TEXT_SECONDARY))
			.child(label)
			.tooltip(tooltip(
				"Ask the device to connect over the debugger bridge",
			))
			.on_click(cx.listener(|this, _, _, cx| {
				let choice = this.default_choice();
				this.connect(choice, cx);
			}));
		let chevron = div()
			.id("connect-menu")
			.flex()
			.items_center()
			.justify_center()
			.h_full()
			.w(px(22.))
			.border_l_1()
			.border_color(theme::color(theme::BORDER))
			.cursor_pointer()
			.when(open, |part| part.bg(theme::color(theme::HOVER)))
			.hover(|part| part.bg(theme::color(theme::HOVER)))
			.child(icon(
				assets::CHEVRON_DOWN,
				theme::CHEVRON,
				theme::TEXT_SECONDARY,
			))
			.on_click(cx.listener(|this, _, window, cx| this.toggle_device_menu(window, cx)));
		div()
			.relative()
			.flex_none()
			.flex()
			.h(theme::ICON_BUTTON)
			.rounded(theme::RADIUS_CONTROL)
			.overflow_hidden()
			.border_1()
			.border_color(theme::color(theme::BORDER))
			.text_size(theme::TEXT_SMALL)
			.text_color(theme::color(theme::TEXT_SECONDARY))
			.child(main)
			.child(chevron)
			.when(open, |control| {
				control.child(
					div().absolute().right_0().bottom_0().child(
						deferred(
							anchored()
								.anchor(Anchor::TopRight)
								.offset(point(px(0.), px(4.)))
								.snap_to_window_with_margin(px(8.))
								.child(self.render_device_menu(window, cx)),
						)
						.with_priority(1),
					),
				)
			})
	}

	pub fn render_menu_backdrop(
		&self,
		window: &Window,
		cx: &mut Context<Self>,
	) -> Option<AnyElement> {
		self.device_menu.as_ref()?;
		let size = window.viewport_size();
		Some(
			deferred(
				anchored().position(point(px(0.), px(0.))).child(
					div()
						.id("menu-backdrop")
						.w(size.width)
						.h(size.height)
						.occlude()
						.on_mouse_down(
							MouseButton::Left,
							cx.listener(|this, _, window, cx| this.close_device_menu(window, cx)),
						),
				),
			)
			.into_any_element(),
		)
	}

	fn render_device_menu(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let menu = self.device_menu.as_ref().expect("the menu is open");
		let body = match &menu.form {
			Some(form) => self.render_preset_form(form, window, cx).into_any_element(),
			None => self
				.render_menu_items(menu.highlighted, cx)
				.into_any_element(),
		};
		div()
			.id("device-menu")
			.key_context(MENU_CONTEXT)
			.track_focus(&menu.focus)
			.on_action(cx.listener(Self::menu_up))
			.on_action(cx.listener(Self::menu_down))
			.on_action(cx.listener(Self::menu_confirm))
			.on_action(cx.listener(Self::menu_dismiss))
			.w(px(MENU_WIDTH))
			.p(px(4.))
			.rounded(px(6.))
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.shadow_lg()
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_UI)
			.text_color(theme::color(theme::TEXT))
			.occlude()
			.child(body)
	}

	fn render_menu_items(&self, highlighted: usize, cx: &mut Context<Self>) -> Div {
		let items = menu_items(&self.presets);
		let presets = self.presets.as_ref().ok();
		let has_saved = presets.is_some_and(|presets| !presets.devices.is_empty());
		let mut list = div().flex().flex_col();
		if let Err(error) = &self.presets {
			list = list.child(
				div()
					.px(px(theme::INSET))
					.py(px(6.))
					.text_size(theme::TEXT_SMALL)
					.line_height(px(16.))
					.text_color(theme::color(theme::ERROR))
					.child(error.clone()),
			);
		}
		if has_saved {
			list = list.child(
				div()
					.px(px(theme::INSET))
					.pt(px(6.))
					.pb(px(4.))
					.child(eyebrow("Saved devices")),
			);
		}
		for (ix, item) in items.into_iter().enumerate() {
			let is_highlighted = ix == highlighted;
			if item == MenuItem::Default && has_saved || item == MenuItem::SavePreset {
				list = list.child(divider());
			}
			let row = match &item {
				MenuItem::Preset(name) => {
					let Some(preset) = presets.and_then(|presets: &Presets| presets.get(name))
					else {
						continue;
					};
					let remove_name = name.clone();
					menu_row(
						format!("preset-{ix}").into(),
						is_highlighted,
						TWO_LINE_ROW_HEIGHT,
					)
					.child(two_lines(preset.name.clone(), preset.bridge.to_string()))
					.child(
						div()
							.id(SharedString::from(format!("remove-{ix}")))
							.flex_none()
							.size(theme::ICON_BUTTON)
							.flex()
							.items_center()
							.justify_center()
							.rounded(theme::RADIUS_CONTROL)
							.hover(|button| button.bg(theme::color(theme::BORDER)))
							.child(icon(assets::X, theme::ICON, theme::TEXT_MUTED))
							.tooltip(tooltip("Remove this device"))
							.on_click(cx.listener(move |this, _, _, cx| {
								cx.stop_propagation();
								this.remove_preset(&remove_name, cx);
							})),
					)
				}
				MenuItem::Default => {
					menu_row("preset-default".into(), is_highlighted, TWO_LINE_ROW_HEIGHT).child(
						two_lines(
							"This machine".to_owned(),
							self.devtools.default_target().bridge.to_string(),
						),
					)
				}
				MenuItem::SavePreset => menu_row("save-preset".into(), is_highlighted, ROW_HEIGHT)
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child("Save as preset"),
			};
			list = list.child(row.on_click(cx.listener(move |this, _, window, cx| {
				this.activate_menu_item(item.clone(), window, cx);
			})));
		}
		list
	}

	fn render_preset_form(
		&self,
		form: &PresetForm,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> impl IntoElement {
		let focused = |input: &Entity<TextInput>| input.focus_handle(cx).is_focused(window);
		let fields = [
			("Name", &form.name),
			("Bridge (host:port)", &form.bridge),
			("Device dials back to (optional)", &form.host),
		]
		.map(|(label, input)| field(label, input, focused(input)));
		div()
			.key_context(FORM_CONTEXT)
			.on_action(cx.listener(Self::form_next))
			.on_action(cx.listener(Self::form_prev))
			.flex()
			.flex_col()
			.gap(px(10.))
			.p(px(theme::INSET))
			.child(
				div()
					.font_weight(FontWeight::MEDIUM)
					.child("Save as preset"),
			)
			.children(fields)
			.when_some(form.error.clone(), |form, error| {
				form.child(
					div()
						.text_size(theme::TEXT_SMALL)
						.line_height(px(16.))
						.text_color(theme::color(theme::ERROR))
						.child(error),
				)
			})
			.child(
				div()
					.flex()
					.justify_end()
					.gap(px(8.))
					.pt(px(2.))
					.child(
						div()
							.id("form-cancel")
							.flex()
							.items_center()
							.h(px(28.))
							.px(px(12.))
							.rounded(theme::RADIUS_CONTROL)
							.cursor_pointer()
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(theme::TEXT_SECONDARY))
							.hover(|button| button.bg(theme::color(theme::HOVER)))
							.child("Cancel")
							.on_click(cx.listener(|this, _, window, cx| {
								this.menu_dismiss(&crate::devices::MenuDismiss, window, cx)
							})),
					)
					.child(primary_button("form-save", "Save", false).on_click(
						cx.listener(|this, _, window, cx| this.submit_preset_form(window, cx)),
					)),
			)
	}
}
