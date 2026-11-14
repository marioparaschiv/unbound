//! The settings sections, their sidebar categories, and each section's cards. Every length goes
//! through [`Scale`], so the whole dialog scales in and out as one.

use gpui::{App, Div, Entity, FontWeight, Pixels, SharedString, div, prelude::*, px};
use gpui_component::input::{Input, InputState};
use gpui_component::switch::Switch;

use crate::settings::{self, Appearance};
use crate::theme;
use crate::update::{self, Status, VERSION};
use crate::widgets::{Raised, field, raised_button};

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
	Agents,
	Updates,
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
		sections: &[Section::Agents],
	},
	Category {
		label: "Application",
		sections: &[Section::Updates, Section::About],
	},
];

impl Section {
	pub fn label(self) -> &'static str {
		match self {
			Self::Appearance => "Appearance",
			Self::Device => "Device",
			Self::Agents => "Agents",
			Self::Updates => "Updates",
			Self::About => "About",
		}
	}

	/// The settings on the section's page, so the sidebar search finds a section by what it holds.
	fn settings(self) -> &'static [&'static str] {
		match self {
			Self::Appearance => &["Theme", "Match the System", "Dark", "Light"],
			Self::Device => &["Bridge Port", "Debugger"],
			Self::Agents => &["Serve MCP", "MCP Port"],
			Self::Updates => &["Check Now", "Check Automatically", "Version"],
			Self::About => &["Version", "Config Directory"],
		}
	}

	/// Whether `query` (lowercase) names the section or one of its settings.
	pub fn matches(self, query: &str) -> bool {
		std::iter::once(self.label())
			.chain(self.settings().iter().copied())
			.any(|text| text.to_lowercase().contains(query))
	}

	pub fn icon(self) -> &'static str {
		match self {
			Self::Appearance => "icons/palette.svg",
			Self::Device => "icons/smartphone.svg",
			Self::Agents => "icons/bot.svg",
			Self::Updates => "icons/refresh-cw.svg",
			Self::About => "icons/info.svg",
		}
	}
}

/// The text fields the sections edit; the dialog owns them so typing survives a re-render.
pub struct Fields {
	pub bridge_port: Entity<InputState>,
	pub mcp_port: Entity<InputState>,
}

/// The settings of `section`, top to bottom. They stand on the page without cards: the section's
/// title already names what they are about.
pub fn render(section: Section, fields: &Fields, s: Scale, cx: &App) -> Vec<Div> {
	match section {
		Section::Appearance => vec![theme_choice(s, cx)],
		Section::Device => vec![setting(
			s,
			"Bridge Port",
			"The port of the bridge on this machine. React DevTools, the view finder and Metro reach the device through it. Connect device reads it when DevTools starts.",
			port(s, &fields.bridge_port),
		)],
		Section::Agents => vec![
			setting(
				s,
				"Serve MCP",
				&format!("Let an agent inspect the same component tree over HTTP. {RESTART}"),
				Switch::new("mcp-enabled")
					.checked(settings::get(cx).mcp_enabled)
					.on_click(|on, _, cx| settings::update(cx, |s| s.mcp_enabled = *on)),
			),
			setting(
				s,
				"MCP Port",
				&format!("Serves http://127.0.0.1:<port>/mcp. {RESTART}"),
				port(s, &fields.mcp_port),
			),
		],
		Section::Updates => vec![
			updates_row(s, cx),
			setting(
				s,
				"Check Automatically",
				"Look for a new version each time DevTools starts, and show a notification when one is out.",
				Switch::new("check-for-updates")
					.checked(settings::get(cx).check_for_updates)
					.on_click(|on, _, cx| settings::update(cx, |s| s.check_for_updates = *on)),
			),
		],
		Section::About => vec![setting(
			s,
			"Version",
			"Settings and saved devices live in the unbound-devtools folder of your config directory.",
			div()
				.font_family(theme::mono_font())
				.text_size(s.px(12.))
				.text_color(theme::color(theme::TEXT_SECONDARY))
				.child(VERSION),
		)],
	}
}

/// The update state in words, and the one action it allows.
fn updates_row(s: Scale, cx: &App) -> Div {
	let (title, description) = match update::status(cx) {
		Status::Idle => (
			format!("Version {VERSION}"),
			"Not checked for updates yet.".to_owned(),
		),
		Status::Checking => (
			format!("Version {VERSION}"),
			"Checking for updates...".to_owned(),
		),
		Status::Current => (
			format!("Version {VERSION}"),
			"DevTools is up to date.".to_owned(),
		),
		Status::Available(found) => (
			format!("Version {} is available", found.version),
			format!(
				"You have {VERSION}. Updating downloads it and replaces this copy of DevTools."
			),
		),
		Status::Installing(found) => (
			format!("Installing {}", found.version),
			"Downloading and checking the update...".to_owned(),
		),
		Status::Installed(version) => (
			format!("Version {version} is installed"),
			"Restart DevTools to use it.".to_owned(),
		),
		Status::Failed(error) => (
			format!("Version {VERSION}"),
			format!("The last check failed: {error}"),
		),
	};
	let control = match update::status(cx) {
		Status::Available(_) => raised_button(
			"install-update",
			Raised::Primary,
			Some("icons/download.svg"),
			"Update",
			true,
		)
		.on_click(|_, _, cx| update::install(cx)),
		Status::Installed(_) => raised_button(
			"restart-update",
			Raised::Primary,
			Some("icons/rotate-cw.svg"),
			"Restart",
			true,
		)
		.on_click(|_, _, cx| update::restart(cx)),
		Status::Checking | Status::Installing(_) => raised_button(
			"check-updates",
			Raised::Secondary,
			None,
			"Working...",
			false,
		),
		Status::Idle | Status::Current | Status::Failed(_) => raised_button(
			"check-updates",
			Raised::Secondary,
			Some("icons/refresh-cw.svg"),
			"Check Now",
			true,
		)
		.on_click(|_, _, cx| update::check(false, cx)),
	};
	setting(s, &title, &description, control)
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
fn setting(s: Scale, title: &str, description: &str, control: impl IntoElement) -> Div {
	div()
		.flex()
		.items_center()
		.gap(s.px(24.))
		.child(label(s, title, description).flex_1().min_w_0())
		.child(div().flex_none().child(control))
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

/// Telecord's theme radio group under its label: one row per palette, the chosen one's ring filled.
fn theme_choice(s: Scale, cx: &App) -> Div {
	let current = settings::get(cx).appearance;
	let options = div()
		.flex()
		.flex_col()
		.gap(s.px(12.))
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
		}));
	div()
		.flex()
		.flex_col()
		.gap(s.px(14.))
		.child(label(
			s,
			"Theme",
			"Light or dark. Match the System follows your operating system as it changes.",
		))
		.child(options)
}

#[cfg(test)]
mod tests {
	use super::Section;

	#[test]
	fn search_finds_a_section_by_its_settings() {
		assert!(Section::Agents.matches("mcp port"));
		assert!(Section::Appearance.matches("dark"));
		assert!(Section::Updates.matches("automatic"));
		assert!(Section::Device.matches("device"));
		assert!(!Section::Device.matches("mcp"));
	}
}
