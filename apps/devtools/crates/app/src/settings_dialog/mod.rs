//! Settings in Telecord's layout: a searchable sidebar of sections, the open section's title and a
//! close button, then its cards. It fades and scales from Telecord's 0.95 over 150ms on Base UI's
//! exponential ease-out, reversed on close, over a 70% black backdrop.

mod sections;

use std::time::{Duration, Instant};

use gpui::{
	App, Context, Entity, EventEmitter, FocusHandle, Focusable, FontWeight, KeyBinding,
	MouseButton, ScrollHandle, Subscription, Task, Window, actions, div, prelude::*, px, relative,
};
use gpui_component::input::{Input, InputEvent, InputState};

use self::sections::{CATEGORIES, Fields, Scale, Section};
use crate::press::Pressable;
use crate::scaled::rem_scaled;
use crate::settings::{self, Settings};
use crate::smooth_scroll::SmoothScroll;
use crate::widgets::{field, float_shadow, icon};
use crate::{assets, theme};

const CONTEXT: &str = "SettingsDialog";
const OPEN: Duration = Duration::from_millis(150);
const CLOSE: Duration = Duration::from_millis(150);
/// Where the surface's scale starts and ends; Telecord's `zoom-in-95`, half Base UI's travel.
const FROM_SCALE: f32 = 0.95;
/// Lets a sidebar row's scaled face answer hover over the row's whole box.
const ROW_GROUP: &str = "settings-row";

actions!(settings_dialog, [Close]);

pub fn bind_keys(cx: &mut App) {
	cx.bind_keys([KeyBinding::new("escape", Close, Some(CONTEXT))]);
}

/// The exit motion finished; the owner drops the dialog.
pub struct Closed;

enum Phase {
	/// Timed from the first frame drawn, not from construction: building the dialog's fields can
	/// take longer than the whole entrance, which would then skip straight to its end.
	Opening(Option<Instant>),
	Closing(Instant),
}

pub struct SettingsDialog {
	section: Section,
	search: Entity<InputState>,
	fields: Fields,
	focus: FocusHandle,
	sidebar_scroll: ScrollHandle,
	body_scroll: ScrollHandle,
	phase: Phase,
	_close: Option<Task<()>>,
	_subscriptions: Vec<Subscription>,
}

impl EventEmitter<Closed> for SettingsDialog {}

impl Focusable for SettingsDialog {
	fn focus_handle(&self, _: &App) -> FocusHandle {
		self.focus.clone()
	}
}

/// Base UI's dialog curve, `cubic-bezier(0.45, 1.005, 0, 1.005)`: an exponential ease-out that
/// covers most of the distance in the first third and settles with a hair of overshoot.
fn ease(t: f32) -> f32 {
	let bezier = |a: f32, b: f32, u: f32| {
		3. * a * u * (1. - u).powi(2) + 3. * b * u * u * (1. - u) + u.powi(3)
	};
	// Bisect for the curve parameter whose x is `t`; 20 steps is far below a pixel.
	let (mut low, mut high) = (0_f32, 1_f32);
	for _ in 0..20 {
		let mid = (low + high) / 2.;
		if bezier(0.45, 0., mid) < t {
			low = mid;
		} else {
			high = mid;
		}
	}
	bezier(1.005, 1.005, (low + high) / 2.)
}

/// Applies a port field's text when it is a valid port; anything else leaves the setting alone.
fn port_input(set: fn(&mut Settings, u16)) -> impl Fn(&str, &mut Settings) {
	move |value, settings| {
		if let Ok(port) = value.trim().parse::<u16>()
			&& port > 0
		{
			set(settings, port);
		}
	}
}

impl SettingsDialog {
	pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
		let current = settings::get(cx).clone();
		let mut input = |value: String, placeholder: &'static str| {
			cx.new(|cx| {
				InputState::new(window, cx)
					.placeholder(placeholder)
					.default_value(value)
			})
		};
		let fields = Fields {
			cli_command: input(current.cli_command.clone(), "ubd"),
			project_dir: input(current.project_dir.clone(), "Your home folder"),
			bridge_port: input(current.bridge_port.to_string(), "9090"),
			mcp_port: input(current.mcp_port.to_string(), "8098"),
		};
		let search = input(String::new(), "Search...");
		let subscriptions = vec![
			cx.subscribe(&search, |_, _, _: &InputEvent, cx| cx.notify()),
			bind(cx, &fields.cli_command, |value, s| {
				s.cli_command = value.trim().to_owned()
			}),
			bind(cx, &fields.project_dir, |value, s| {
				s.project_dir = value.trim().to_owned()
			}),
			bind(
				cx,
				&fields.bridge_port,
				port_input(|s, port| s.bridge_port = port),
			),
			bind(
				cx,
				&fields.mcp_port,
				port_input(|s, port| s.mcp_port = port),
			),
			// The theme radio and MCP switch write the store directly; redraw to show the change.
			cx.observe_global::<settings::Store>(|_, cx| cx.notify()),
		];
		Self {
			section: Section::Appearance,
			search,
			fields,
			focus: cx.focus_handle(),
			sidebar_scroll: ScrollHandle::new(),
			body_scroll: ScrollHandle::new(),
			phase: Phase::Opening(None),
			_close: None,
			_subscriptions: subscriptions,
		}
	}

	pub fn is_closing(&self) -> bool {
		matches!(self.phase, Phase::Closing(_))
	}

	/// Plays the exit motion, then emits [`Closed`].
	pub fn close(&mut self, cx: &mut Context<Self>) {
		if self.is_closing() {
			return;
		}
		self.phase = Phase::Closing(Instant::now());
		self._close = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(CLOSE).await;
			this.update(cx, |_, cx| cx.emit(Closed)).ok();
		}));
		cx.notify();
	}

	/// How far open the dialog is, eased, and whether it is still moving.
	fn progress(&mut self) -> (f32, bool) {
		let (start, duration, opening) = match &mut self.phase {
			Phase::Opening(start) => (*start.get_or_insert_with(Instant::now), OPEN, true),
			Phase::Closing(start) => (*start, CLOSE, false),
		};
		let t = (start.elapsed().as_secs_f32() / duration.as_secs_f32()).min(1.);
		let open = if opening { ease(t) } else { 1. - ease(t) };
		(open, t < 1.)
	}

	fn visible_categories(&self, cx: &App) -> Vec<(&'static str, Vec<Section>)> {
		let query = self.search.read(cx).value().trim().to_lowercase();
		CATEGORIES
			.iter()
			.map(|category| {
				let sections = category
					.sections
					.iter()
					.copied()
					.filter(|section| section.label().to_lowercase().contains(&query))
					.collect::<Vec<_>>();
				(category.label, sections)
			})
			.filter(|(_, sections)| !sections.is_empty())
			.collect()
	}

	fn render_sidebar(&self, s: Scale, cx: &mut Context<Self>) -> impl IntoElement {
		let search = field(
			Input::new(&self.search)
				.prefix(icon(assets::SEARCH, s.px(14.), theme::TEXT_MUTED))
				.cleanable(true),
		)
		.h(s.px(36.))
		.px(s.px(12.))
		.rounded(s.px(10.))
		.text_size(s.px(13.));
		let sidebar = div()
			.id("settings-sidebar")
			.flex_none()
			.w(s.px(232.))
			.flex()
			.flex_col()
			.gap(s.px(2.))
			.p(s.px(12.))
			.overflow_y_scroll()
			.track_scroll(&self.sidebar_scroll)
			.child(div().mb(s.px(8.)).child(search))
			.children(
				self.visible_categories(cx)
					.into_iter()
					.map(|(label, sections)| {
						let rows: Vec<_> = sections
							.into_iter()
							.map(|section| self.render_row(section, s, cx).into_any_element())
							.collect();
						div()
							.flex()
							.flex_col()
							.gap(s.px(2.))
							.child(
								div()
									.px(s.px(12.))
									.pt(s.px(8.))
									.pb(s.px(4.))
									.text_size(s.px(11.))
									.font_weight(FontWeight::MEDIUM)
									.text_color(theme::color(theme::TEXT_MUTED))
									.child(label.to_uppercase()),
							)
							.children(rows)
					}),
			);
		SmoothScroll::new("settings-sidebar-glide", &self.sidebar_scroll, sidebar)
	}

	/// A section's row; pressing shrinks its face like the app's sidebar rows.
	fn render_row(&self, section: Section, s: Scale, cx: &mut Context<Self>) -> impl IntoElement {
		let active = section == self.section;
		let (text, glyph) = if active {
			(theme::TEXT, theme::TEXT)
		} else {
			(theme::TEXT_SECONDARY, theme::TEXT_MUTED)
		};
		let face = move |press: f32| {
			let k = Scale(s.0 * press);
			let inset = relative((1. - press) / 2.);
			div()
				.absolute()
				.top(inset)
				.bottom(inset)
				.left(inset)
				.right(inset)
				.flex()
				.items_center()
				.gap(k.px(10.))
				.px(k.px(12.))
				.rounded(k.px(8.))
				.text_size(k.px(13.))
				.text_color(theme::color(text))
				.map(|face| {
					if active {
						face.bg(theme::color(theme::HOVER))
							.font_weight(FontWeight::MEDIUM)
					} else {
						face.group_hover(ROW_GROUP, |face| {
							face.bg(theme::alpha(theme::HOVER, 0.6))
								.text_color(theme::color(theme::TEXT))
						})
					}
				})
				.child(icon(section.icon(), k.px(16.), glyph))
				.child(div().min_w_0().truncate().child(section.label()))
				.into_any_element()
		};
		let body = div().h(s.px(34.)).group(ROW_GROUP).cursor_pointer();
		Pressable::flat(section.label(), body, face).on_click(cx.listener(move |this, _, _, cx| {
			this.section = section;
			cx.notify();
		}))
	}

	fn render_main(&self, s: Scale, cx: &mut Context<Self>) -> impl IntoElement {
		let header = div()
			.flex_none()
			.flex()
			.items_center()
			.gap(s.px(12.))
			.px(s.px(16.))
			.py(s.px(12.))
			.child(icon(self.section.icon(), s.px(20.), theme::TEXT))
			.child(
				div()
					.flex_1()
					.min_w_0()
					.truncate()
					.text_size(s.px(18.))
					.font_weight(FontWeight::SEMIBOLD)
					.child(self.section.label()),
			)
			.child(
				div()
					.id("settings-close")
					.flex_none()
					.size(s.px(32.))
					.flex()
					.items_center()
					.justify_center()
					.rounded(s.px(8.))
					.cursor_pointer()
					.hover(|button| button.bg(theme::color(theme::HOVER)))
					.child(icon(assets::X, s.px(16.), theme::TEXT_SECONDARY))
					.on_click(cx.listener(|this, _, _, cx| this.close(cx))),
			);
		div()
			.flex_1()
			.min_w_0()
			.flex()
			.flex_col()
			.child(header)
			.child(div().flex_none().h(px(1.)).bg(theme::color(theme::BORDER)))
			.child(SmoothScroll::new(
				"settings-body-glide",
				&self.body_scroll,
				div()
					.id("settings-body")
					.flex_1()
					.min_h_0()
					.overflow_y_scroll()
					.track_scroll(&self.body_scroll)
					.p(s.px(16.))
					.flex()
					.flex_col()
					.items_center()
					.child(
						div()
							.w_full()
							.max_w(s.px(896.))
							.flex()
							.flex_col()
							.gap(s.px(16.))
							.children(sections::render(self.section, &self.fields, s, cx)),
					),
			))
	}
}

/// Writes `field`'s text into the settings on every edit.
fn bind(
	cx: &mut Context<SettingsDialog>,
	field: &Entity<InputState>,
	apply: impl Fn(&str, &mut Settings) + 'static,
) -> Subscription {
	cx.subscribe(field, move |_, field, event: &InputEvent, cx| {
		if matches!(event, InputEvent::Change) {
			let value = field.read(cx).value();
			settings::update(cx, |settings| apply(&value, settings));
		}
	})
}

impl Render for SettingsDialog {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let (open, moving) = self.progress();
		if moving {
			window.request_animation_frame();
		}
		let s = Scale(FROM_SCALE + (1. - FROM_SCALE) * open);
		// Most of the window, as Telecord fills it below 1536px, but kept clear of its edges and
		// capped so lines stay readable on a wide screen.
		let viewport = window.viewport_size();
		let room = |size: gpui::Pixels, share: f32, min: f32, cap: f32| {
			let max = f32::from(size) - 48.;
			(f32::from(size) * share).clamp(min, cap).min(max)
		};
		let (width, height) = (
			room(viewport.width, 0.8, 880., 1200.),
			room(viewport.height, 0.8, 520., 860.),
		);
		let surface = div()
			.id("settings")
			.key_context(CONTEXT)
			.track_focus(&self.focus)
			.on_action(cx.listener(|this, _: &Close, _, cx| this.close(cx)))
			.on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
			.w(s.px(width))
			.h(s.px(height))
			.flex()
			.rounded(s.px(12.))
			.border_1()
			.border_color(theme::color(theme::BORDER))
			.bg(theme::color(theme::APP))
			.shadow(float_shadow())
			.overflow_hidden()
			.opacity(open)
			.child(self.render_sidebar(s, cx))
			.child(div().flex_none().w(px(1.)).bg(theme::color(theme::BORDER)))
			.child(self.render_main(s, cx));
		div()
			.id("settings-backdrop")
			.absolute()
			.inset_0()
			.occlude()
			.flex()
			.items_center()
			.justify_center()
			.bg(gpui::black().opacity(0.7 * open))
			.on_mouse_down(
				MouseButton::Left,
				cx.listener(|this, _, _, cx| this.close(cx)),
			)
			.child(rem_scaled(surface, s.0))
	}
}

#[cfg(test)]
mod tests {
	use super::ease;

	#[test]
	fn ease_starts_fast_and_settles() {
		assert!(ease(0.).abs() < 1e-4);
		assert!((ease(1.) - 1.).abs() < 1e-4);
		// Exponential: most of the way there a quarter of the way in, never far past the end.
		assert!(ease(0.25) > 0.7);
		assert!((0..=100).all(|step| ease(step as f32 / 100.) < 1.01));
	}
}
