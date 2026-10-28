//! Design tokens. Every color, size and font the app draws with comes from here.

use gpui::{Hsla, Pixels, Rgba, SharedString, px, rgb, rgba};

pub const APP: u32 = 0x0E0E10;
pub const PANEL: u32 = 0x141417;
pub const ELEVATED: u32 = 0x1B1B1F;
pub const HOVER: u32 = 0x1E1E23;
pub const BORDER: u32 = 0x26262C;
pub const BORDER_STRONG: u32 = 0x33333A;

pub const TEXT: u32 = 0xECECF1;
pub const TEXT_SECONDARY: u32 = 0xA1A1AA;
pub const TEXT_MUTED: u32 = 0x71717A;
pub const TEXT_FAINT: u32 = 0x52525B;

pub const ACCENT: u32 = 0xE0525F;
pub const ACCENT_HOVER: u32 = 0xEA6470;

pub const WARNING: u32 = 0xE5A943;
pub const ERROR: u32 = 0xE5484D;

pub const SYN_COMPONENT: u32 = 0xE6E6EA;
pub const SYN_HOST: u32 = 0x8B8B96;
pub const SYN_KEY_ATTR: u32 = 0xE0A370;
pub const SYN_KEY_VALUE: u32 = 0xE6C47C;
pub const SYN_HOC_TEXT: u32 = 0xA1A1AA;
pub const SYN_HOC_BG: u32 = 0x232328;
pub const SYN_PROP_KEY: u32 = 0x9CB4FF;
pub const SYN_STRING: u32 = 0x8FD19E;
pub const SYN_NUMBER: u32 = 0xF0A35E;
pub const SYN_LITERAL: u32 = 0xC792EA;
pub const SYN_FUNCTION: u32 = 0x7FC8F8;
pub const SYN_ELEMENT: u32 = 0xE6E6EA;

pub fn color(hex: u32) -> Rgba {
	rgb(hex)
}

/// `hex` at `alpha` (0 to 1).
pub fn alpha(hex: u32, alpha: f32) -> Rgba {
	rgba((hex << 8) | (alpha.clamp(0.0, 1.0) * 255.0).round() as u32)
}

/// The selected row's background: the accent at 14 %.
pub fn accent_soft() -> Rgba {
	alpha(ACCENT, 0.14)
}

pub fn hsla(hex: u32) -> Hsla {
	rgb(hex).into()
}

pub const TEXT_UI: Pixels = px(13.);
pub const TEXT_SMALL: Pixels = px(12.);
pub const TEXT_EYEBROW: Pixels = px(11.);
pub const TEXT_MONO: Pixels = px(12.5);
pub const TEXT_TITLE: Pixels = px(13.);
pub const TEXT_HERO: Pixels = px(16.);

pub const RADIUS_CONTROL: Pixels = px(4.);

pub const TOOLBAR_HEIGHT: Pixels = px(40.);
pub const PANEL_HEADER_HEIGHT: Pixels = px(32.);
pub const STATUS_HEIGHT: Pixels = px(28.);
pub const BREADCRUMB_HEIGHT: Pixels = px(28.);
pub const ROW_HEIGHT: Pixels = px(24.);
pub const VALUE_ROW_HEIGHT: Pixels = px(22.);
pub const ICON_BUTTON: Pixels = px(24.);
pub const ICON: Pixels = px(14.);
pub const CHEVRON: Pixels = px(10.);
/// Indent per tree level; equal to the chevron slot so a child's guide sits under its parent's chevron.
pub const INDENT: f32 = 16.;
/// Horizontal inset shared by panel headers, rows and section headers so their content lines up.
pub const INSET: f32 = 8.;

pub const INSPECTOR_MIN: f32 = 320.;
pub const TREE_MIN: f32 = 360.;
pub const INSPECTOR_MAX: f32 = 640.;
pub const INSPECTOR_DEFAULT: f32 = 400.;

pub fn ui_font() -> SharedString {
	// gpui finds no font for `.SystemUIFont` on Linux and logs a miss for every weight.
	if cfg!(any(target_os = "macos", target_os = "windows")) {
		".SystemUIFont".into()
	} else {
		"DejaVu Sans".into()
	}
}

pub fn mono_font() -> SharedString {
	if cfg!(target_os = "macos") {
		"Menlo".into()
	} else if cfg!(target_os = "windows") {
		"Consolas".into()
	} else {
		"DejaVu Sans Mono".into()
	}
}
