use gpui::{
	AnyElement, Context, Div, Entity, FontWeight, MouseButton, SharedString, Stateful, Window,
	anchored, deferred, div, point, prelude::*, px,
};
use unbound_devtools_core::Presets;

use crate::devices::{DeviceChoice, FORM_CONTEXT, MENU_CONTEXT, MenuItem, PresetForm};
use crate::link::DebuggerLink;
use crate::widgets::{Raised, eyebrow, field, float_shadow, icon, raised_button, tooltip};
use crate::{assets, theme};
use gpui_component::input::{Input, InputState};

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

/// A dot in front of the linked device's row; an empty slot keeps the other rows' titles aligned.
fn linked_mark(linked: bool) -> Div {
	div()
		.flex_none()
		.size(px(6.))
		.rounded_full()
		.when(linked, |mark| mark.bg(theme::color(theme::SUCCESS)))
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
				.font_weight(FontWeight::MEDIUM)
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

fn labelled(label: &'static str, input: &Entity<InputState>) -> Div {
	div()
		.flex()
		.flex_col()
		.gap(px(6.))
		.child(
			div()
				.text_size(theme::TEXT_SMALL)
				.font_weight(FontWeight::MEDIUM)
				.text_color(theme::color(theme::TEXT_SECONDARY))
				.child(label),
		)
		.child(field(Input::new(input)))
}

impl DebuggerLink {
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

	pub fn render_device_menu(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let menu = self.device_menu.as_ref().expect("the menu is open");
		let body = match &menu.form {
			Some(form) => self.render_preset_form(form, cx).into_any_element(),
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
			// Concentric with the rows: the surface radius less this padding is theirs.
			.p(px(6.))
			.rounded(theme::RADIUS_SURFACE)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.shadow(float_shadow())
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_UI)
			// The menu hangs inside the banner and would inherit its medium title.
			.font_weight(FontWeight::NORMAL)
			.text_color(theme::color(theme::TEXT))
			.occlude()
			.child(body)
	}

	fn render_menu_items(&self, highlighted: usize, cx: &mut Context<Self>) -> Div {
		let items = self.items();
		let presets = self.presets.as_ref().ok();
		let has_saved = presets.is_some_and(|presets| !presets.devices.is_empty());
		let linked = self.status.link.is_some().then(|| self.current_choice());
		let errors = [
			self.presets.as_ref().err().cloned(),
			self.error.clone(),
			self.status
				.link
				.as_ref()
				.and_then(|link| link.error.clone()),
		];
		let mut list = div().flex().flex_col();
		for error in errors.into_iter().flatten() {
			list = list.child(
				div()
					.px(px(theme::INSET))
					.py(px(6.))
					.text_size(theme::TEXT_SMALL)
					.line_height(px(16.))
					.text_color(theme::color(theme::ERROR))
					.child(error),
			);
		}
		if has_saved {
			list = list.child(
				div()
					.px(px(theme::INSET))
					.pt(px(6.))
					.pb(px(4.))
					.child(eyebrow("Saved Devices")),
			);
		}
		for (ix, item) in items.into_iter().enumerate() {
			let is_highlighted = ix == highlighted;
			if item == MenuItem::Default && has_saved || item == MenuItem::SavePreset {
				list = list.child(divider());
			}
			if item == MenuItem::Disconnect {
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
					.child(linked_mark(
						linked == Some(DeviceChoice::Preset(preset.name.clone())),
					))
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
					menu_row("preset-default".into(), is_highlighted, TWO_LINE_ROW_HEIGHT)
						.child(linked_mark(linked == Some(DeviceChoice::Default)))
						.child(two_lines(
							"This Machine".to_owned(),
							self.devtools.default_target().bridge.to_string(),
						))
				}
				MenuItem::SavePreset => menu_row("save-preset".into(), is_highlighted, ROW_HEIGHT)
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child("Save as Preset"),
				MenuItem::Disconnect => menu_row("disconnect".into(), is_highlighted, ROW_HEIGHT)
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child("Disconnect"),
			};
			list = list.child(row.on_click(cx.listener(move |this, _, window, cx| {
				this.activate_menu_item(item.clone(), window, cx);
			})));
		}
		list
	}

	fn render_preset_form(&self, form: &PresetForm, cx: &mut Context<Self>) -> impl IntoElement {
		let fields = [
			("Name", &form.name),
			("Bridge (host:port)", &form.bridge),
			("Device Dials Back To (Optional)", &form.host),
		]
		.map(|(label, input)| labelled(label, input));
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
					.child("Save as Preset"),
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
						raised_button("form-cancel", Raised::Secondary, None, "Cancel", true)
							.on_click(cx.listener(|this, _, window, cx| {
								this.menu_dismiss(&crate::devices::MenuDismiss, window, cx)
							})),
					)
					.child(
						raised_button("form-save", Raised::Primary, None, "Save", true).on_click(
							cx.listener(|this, _, window, cx| this.submit_preset_form(window, cx)),
						),
					),
			)
	}
}
