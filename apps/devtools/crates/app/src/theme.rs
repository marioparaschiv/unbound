//! Unbound's palette and metrics for the hand-drawn panels (the component tree, the inspector).
//! The colours mirror `apps/web/src/styles.css`; gpui-component's widgets read the same values from
//! `assets/themes/unbound.json`, so both halves of the window agree.

use std::sync::atomic::{AtomicBool, Ordering};

use gpui::{Hsla, Pixels, Rgba, SharedString, px, rgb, rgba};

/// A colour role; [`color`] resolves it against the light or dark palette.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Token {
	App,
	Panel,
	Elevated,
	Hover,
	/// The sunk well behind a transcript, the web's `--field`.
	Field,
	Border,
	BorderStrong,
	/// The body of a raised secondary button, the web's `--secondary`, and its hover `--accent`.
	Secondary,
	SecondaryHover,
	/// The solid edge under a raised secondary button, the web's `--ledge-secondary`.
	LedgeSecondary,
	Text,
	TextSecondary,
	TextMuted,
	TextFaint,
	Accent,
	AccentHover,
	OnAccent,
	Warning,
	Error,
	Success,
	SynComponent,
	SynHost,
	SynKeyAttr,
	SynKeyValue,
	SynHocText,
	SynHocBg,
	SynPropKey,
	SynString,
	SynNumber,
	SynLiteral,
	SynFunction,
}

pub const APP: Token = Token::App;
pub const PANEL: Token = Token::Panel;
pub const ELEVATED: Token = Token::Elevated;
pub const HOVER: Token = Token::Hover;
pub const FIELD: Token = Token::Field;
pub const BORDER: Token = Token::Border;
pub const BORDER_STRONG: Token = Token::BorderStrong;
pub const SECONDARY: Token = Token::Secondary;
pub const SECONDARY_HOVER: Token = Token::SecondaryHover;
pub const LEDGE_SECONDARY: Token = Token::LedgeSecondary;
pub const TEXT: Token = Token::Text;
pub const TEXT_SECONDARY: Token = Token::TextSecondary;
pub const TEXT_MUTED: Token = Token::TextMuted;
pub const TEXT_FAINT: Token = Token::TextFaint;
pub const ACCENT: Token = Token::Accent;
pub const ACCENT_HOVER: Token = Token::AccentHover;
pub const ON_ACCENT: Token = Token::OnAccent;
pub const WARNING: Token = Token::Warning;
pub const ERROR: Token = Token::Error;
pub const SUCCESS: Token = Token::Success;
pub const SYN_COMPONENT: Token = Token::SynComponent;
pub const SYN_HOST: Token = Token::SynHost;
pub const SYN_KEY_ATTR: Token = Token::SynKeyAttr;
pub const SYN_KEY_VALUE: Token = Token::SynKeyValue;
pub const SYN_HOC_TEXT: Token = Token::SynHocText;
pub const SYN_HOC_BG: Token = Token::SynHocBg;
pub const SYN_PROP_KEY: Token = Token::SynPropKey;
pub const SYN_STRING: Token = Token::SynString;
pub const SYN_NUMBER: Token = Token::SynNumber;
pub const SYN_LITERAL: Token = Token::SynLiteral;
pub const SYN_FUNCTION: Token = Token::SynFunction;
pub const SYN_ELEMENT: Token = Token::SynComponent;

/// The web's `.dark` tokens: zinc surfaces, the `#ab3745` brand, and its lifted link tint.
fn dark(token: Token) -> u32 {
	match token {
		Token::App => 0x09090B,
		Token::Panel => 0x121215,
		Token::Elevated => 0x18181B,
		Token::Hover => 0x222226,
		Token::Field => 0x060607,
		Token::Border => 0x232327,
		Token::BorderStrong => 0x2F2F34,
		Token::Secondary => 0x27272A,
		Token::SecondaryHover => 0x2F2F33,
		Token::LedgeSecondary => 0x161619,
		Token::Text => 0xFAFAFA,
		Token::TextSecondary => 0xC4C4CC,
		Token::TextMuted => 0x9F9FA9,
		Token::TextFaint => 0x5D5D66,
		Token::Accent => 0xAB3745,
		Token::AccentHover => 0xE39093,
		Token::OnAccent => 0xFCFCFC,
		Token::Warning => 0xFFB900,
		Token::Error => 0xFF6467,
		Token::Success => 0x00C950,
		Token::SynComponent => 0xECECF1,
		Token::SynHost => 0x8B8B96,
		Token::SynKeyAttr => 0xE0A370,
		Token::SynKeyValue => 0xE6C47C,
		Token::SynHocText => 0xA1A1AA,
		Token::SynHocBg => 0x232328,
		Token::SynPropKey => 0x9CB4FF,
		Token::SynString => 0x8FD19E,
		Token::SynNumber => 0xF0A35E,
		Token::SynLiteral => 0xC792EA,
		Token::SynFunction => 0x7FC8F8,
	}
}

/// The web's `:root` tokens.
fn light(token: Token) -> u32 {
	match token {
		Token::App => 0xFFFFFF,
		Token::Panel => 0xFAFAFB,
		Token::Elevated => 0xFFFFFF,
		Token::Hover => 0xF1F1F3,
		Token::Field => 0xF4F4F5,
		Token::Border => 0xE4E4E7,
		Token::BorderStrong => 0xD4D4D7,
		Token::Secondary => 0xF4F4F5,
		Token::SecondaryHover => 0xEBEBEC,
		Token::LedgeSecondary => 0xD4D4D8,
		Token::Text => 0x111213,
		Token::TextSecondary => 0x3F3F46,
		Token::TextMuted => 0x71717B,
		Token::TextFaint => 0xA1A1AA,
		Token::Accent => 0xAB3745,
		Token::AccentHover => 0xA12D3D,
		Token::OnAccent => 0xFCFCFC,
		Token::Warning => 0xE17100,
		Token::Error => 0xD00114,
		Token::Success => 0x00A63E,
		Token::SynComponent => 0x18181B,
		Token::SynHost => 0x71717B,
		Token::SynKeyAttr => 0xB45309,
		Token::SynKeyValue => 0xA16207,
		Token::SynHocText => 0x52525B,
		Token::SynHocBg => 0xEDEDF0,
		Token::SynPropKey => 0x2F55D4,
		Token::SynString => 0x15803D,
		Token::SynNumber => 0xC2410C,
		Token::SynLiteral => 0x7E22CE,
		Token::SynFunction => 0x0369A1,
	}
}

static DARK: AtomicBool = AtomicBool::new(true);

/// Picks the palette; the appearance module calls it with gpui-component's mode.
pub fn set_dark(dark: bool) {
	DARK.store(dark, Ordering::Relaxed);
}

pub fn is_dark() -> bool {
	DARK.load(Ordering::Relaxed)
}

fn hex(token: Token) -> u32 {
	if is_dark() { dark(token) } else { light(token) }
}

pub fn color(token: Token) -> Rgba {
	rgb(hex(token))
}

pub fn alpha(token: Token, alpha: f32) -> Rgba {
	rgba((hex(token) << 8) | (alpha.clamp(0.0, 1.0) * 255.0).round() as u32)
}

pub fn accent_soft() -> Rgba {
	alpha(ACCENT, if is_dark() { 0.22 } else { 0.1 })
}

pub fn hsla(token: Token) -> Hsla {
	color(token).into()
}

pub const TEXT_UI: Pixels = px(13.);
pub const TEXT_SMALL: Pixels = px(12.);
pub const TEXT_EYEBROW: Pixels = px(11.);
pub const TEXT_MONO: Pixels = px(12.5);
pub const TEXT_TITLE: Pixels = px(13.);
pub const TEXT_HERO: Pixels = px(18.);

/// The web's plump radii, scaled to desktop density: rows, controls, surfaces.
pub const RADIUS_ITEM: Pixels = px(8.);
pub const RADIUS_CONTROL: Pixels = px(10.);
pub const RADIUS_SURFACE: Pixels = px(14.);

/// Every page header and the sidebar header share this height, so their bottom edges line up.
pub const PAGE_HEADER_HEIGHT: Pixels = px(56.);
pub const PANEL_HEADER_HEIGHT: Pixels = px(36.);
/// Every bottom bar (the sidebar's footer, the status bar, a command's run bar) shares this height,
/// so their top borders and text baselines meet across the panes. It fits a raised button and its ledge.
pub const FOOTER_HEIGHT: Pixels = px(52.);
pub const BREADCRUMB_HEIGHT: Pixels = px(30.);
pub const ROW_HEIGHT: Pixels = px(26.);
pub const VALUE_ROW_HEIGHT: Pixels = px(26.);
pub const ICON_BUTTON: Pixels = px(26.);
/// The footprint of every field, segmented track and raised button (body plus ledge), so controls
/// on one row share a top and bottom edge.
pub const CONTROL_HEIGHT: Pixels = px(36.);
/// The solid edge under a raised button, the web's `--ledge-depth`.
pub const LEDGE: Pixels = px(4.);
pub const ICON: Pixels = px(14.);
pub const CHEVRON: Pixels = px(10.);
pub const CHEVRON_SLOT: f32 = 16.;
pub const INDENT: f32 = CHEVRON_SLOT;
/// The page gutter: every page's content starts this far from the sidebar.
pub const GUTTER: f32 = 20.;
pub const INSET: f32 = 10.;

pub const SIDEBAR_WIDTH: Pixels = px(236.);
pub const INSPECTOR_MIN: f32 = 320.;
pub const TREE_MIN: f32 = 360.;
pub const INSPECTOR_MAX: f32 = 640.;
pub const INSPECTOR_DEFAULT: f32 = 400.;

pub fn ui_font() -> SharedString {
	"Geist".into()
}

pub fn mono_font() -> SharedString {
	"JetBrains Mono".into()
}
