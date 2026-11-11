//! The settings sections, their sidebar categories, and each section's cards. Every length goes
//! through [`Scale`], so the whole dialog scales in and out as one.

use gpui::{App, Div, Entity, FontWeight, Pixels, SharedString, div, prelude::*, px};
use gpui_component::input::{Input, InputState};
use gpui_component::switch::Switch;

use crate::settings::{self, Appearance};
use crate::theme;
use crate::widgets::{field, icon};

const RESTART: &str = "Takes effect the next time DevTools starts.";

/// The dialog's current scale; multiplies every pixel length drawn inside it.
#[derive(Clone, Copy)]
pub struct Scale(pub f32);

impl Scale {
	pub fn px(self, value: f32) -> Pixels {
		px(value * self.0)
	}
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Section {
	Appearance,
	Device,
	CommandLine,
	Agents,
	About,
}

/// A titled run of sections in the sidebar.
pub struct Category {
	pub label: &'static str,
	pub sections: &'static [Section],
}

pub const CATEGORIES: &[Category] = &[
	Category {
		label: "Display",
		sections: &[Section::Appearance],
	},
	Category {
		label: "Connection",
		sections: &[Section::Device],
	},
	Category {
		label: "Tools",
		sections: &[Section::CommandLine, Section::Agents],
	},
	Category {
		label: "Application",
		sections: &[Section::About],
	},
];

impl Section {
	pub fn label(self) -> &'static str {
		match self {
			Self::Appearance => "Appearance",
			Self::Device => "Device",
			Self::CommandLine => "Command Line",
			Self::Agents => "Agents",
			Self::About => "About",
		}
	}

	pub fn icon(self) -> &'static str {
		match self {
			Self::Appearance => "icons/palette.svg",
			Self::Device => "icons/smartphone.svg",
			Self::CommandLine => "icons/square-terminal.svg",
			Self::Agents => "icons/bot.svg",
			Self::About => "icons/info.svg",
		}
	}
}

/// The text fields the sections edit; the dialog owns them so typing survives a re-render.
pub struct Fields {
	pub cli_command: Entity<InputState>,
	pub project_dir: Entity<InputState>,
	pub bridge_port: Entity<InputState>,
	pub mcp_port: Entity<InputState>,
}

/// The cards of `section`, top to bottom.
pub fn render(section: Section, fields: &Fields, s: Scale, cx: &App) -> Vec<Div> {
	match section {
		Section::Appearance => vec![card(s, "icons/sun-moon.svg", "Theme").child(theme_choice(s, cx))],
		Section::Device => vec![card(s, "icons/cable.svg", "Debugger Bridge").child(row(
			s,
			"Bridge Port",
			"The port of the bridge on this machine. React DevTools, the view finder and ubd reach the device through it. Connect device reads it when DevTools starts.",
			port(s, &fields.bridge_port),
		))],
		Section::CommandLine => vec![
			card(s, "icons/terminal.svg", "ubd")
				.child(stacked(
					s,
					"Run ubd With",
					"The command that starts the CLI, such as ubd or bunx @unbound-app/cli. ubd runs the copy shipped with DevTools when there is one.",
					text(s, &fields.cli_command),
				))
				.child(stacked(
					s,
					"Project Folder",
					"Where commands run: your addon workspace for build, check and dev. Empty is your home folder.",
					text(s, &fields.project_dir),
				)),
		],
		Section::Agents => vec![
			card(s, "icons/server.svg", "MCP")
				.child(row(
					s,
					"Serve MCP",
					&format!("Let an agent inspect the same component tree over HTTP. {RESTART}"),
					Switch::new("mcp-enabled")
						.checked(settings::get(cx).mcp_enabled)
						.on_click(|on, _, cx| settings::update(cx, |s| s.mcp_enabled = *on)),
				))
				.child(row(
					s,
					"MCP Port",
					&format!("Serves http://127.0.0.1:<port>/mcp. {RESTART}"),
					port(s, &fields.mcp_port),
				)),
		],
		Section::About => vec![
			card(s, "icons/info.svg", "Unbound DevTools")
				.child(row(
					s,
					"Version",
					"Settings and saved devices live in the unbound-devtools folder of your config directory.",
					div()
						.font_family(theme::mono_font())
						.text_size(s.px(12.))
						.text_color(theme::color(theme::TEXT_SECONDARY))
						.child(env!("CARGO_PKG_VERSION")),
				)),
		],
	}
}

/// Telecord's settings card: a tinted title strip over a body of rows, each below a rule.
fn card(s: Scale, path: &'static str, title: &'static str) -> Div {
	let strip = div()
		.flex()
		.items_center()
		.gap(s.px(8.))
		.px(s.px(16.))
		.py(s.px(12.))
		.bg(theme::alpha(theme::HOVER, 0.45))
		.child(icon(path, s.px(16.), theme::TEXT_MUTED))
		.child(
			div()
				.text_size(s.px(13.))
				.font_weight(FontWeight::MEDIUM)
				.child(title),
		);
	div()
		.flex()
		.flex_col()
		.rounded(s.px(12.))
		.border_1()
		.border_color(theme::color(theme::BORDER))
		.bg(theme::color(theme::PANEL))
		.overflow_hidden()
		.child(strip)
}

fn label(s: Scale, title: &str, description: &str) -> Div {
	div()
		.flex()
		.flex_col()
		.gap(s.px(4.))
		.child(
			div()
				.text_size(s.px(13.))
				.font_weight(FontWeight::MEDIUM)
				.child(SharedString::from(title.to_owned())),
		)
		.child(
			div()
				.text_size(s.px(12.))
				.line_height(s.px(18.))
				.text_color(theme::color(theme::TEXT_MUTED))
				.child(SharedString::from(description.to_owned())),
		)
}

/// A setting with its control on the right.
fn row(s: Scale, title: &str, description: &str, control: impl IntoElement) -> Div {
	div()
		.flex()
		.items_center()
		.gap(s.px(24.))
		.px(s.px(16.))
		.py(s.px(14.))
		.border_t_1()
		.border_color(theme::color(theme::BORDER))
		.child(label(s, title, description).flex_1().min_w_0())
		.child(div().flex_none().child(control))
}

/// A setting whose field takes the full width under its label.
fn stacked(s: Scale, title: &str, description: &str, control: impl IntoElement) -> Div {
	div()
		.flex()
		.flex_col()
		.gap(s.px(10.))
		.px(s.px(16.))
		.py(s.px(14.))
		.border_t_1()
		.border_color(theme::color(theme::BORDER))
		.child(label(s, title, description))
		.child(control)
}

/// The app's sunk field at the dialog's scale.
fn text(s: Scale, state: &Entity<InputState>) -> impl IntoElement {
	field(Input::new(state))
		.h(s.px(36.))
		.px(s.px(12.))
		.rounded(s.px(10.))
		.text_size(s.px(13.))
}

fn port(s: Scale, state: &Entity<InputState>) -> impl IntoElement {
	div().w(s.px(120.)).child(text(s, state))
}

/// Telecord's theme radio group: one row per palette, the chosen one's ring filled.
fn theme_choice(s: Scale, cx: &App) -> Div {
	let current = settings::get(cx).appearance;
	div()
		.flex()
		.flex_col()
		.gap(s.px(12.))
		.px(s.px(16.))
		.py(s.px(16.))
		.border_t_1()
		.border_color(theme::color(theme::BORDER))
		.children(Appearance::ALL.into_iter().map(|appearance| {
			let chosen = appearance == current;
			div()
				.id(appearance.key())
				.flex()
				.items_center()
				.gap(s.px(12.))
				.cursor_pointer()
				.text_size(s.px(13.))
				.child(
					div()
						.flex_none()
						.size(s.px(16.))
						.flex()
						.items_center()
						.justify_center()
						.rounded_full()
						.border_1()
						.border_color(theme::color(if chosen {
							theme::ACCENT
						} else {
							theme::BORDER_STRONG
						}))
						.when(chosen, |ring| {
							ring.child(
								div()
									.size(s.px(8.))
									.rounded_full()
									.bg(theme::color(theme::ACCENT)),
							)
						}),
				)
				.child(appearance.label())
				.on_click(move |_, _, cx| settings::update(cx, |s| s.appearance = appearance))
		}))
}
