//! The window's title bar: a bare strip in the sidebar's colour that drags the window, with the
//! platform's window buttons (macOS's traffic lights sit over its left end). The page panel tucks
//! under it with a rounded corner, as in Discord.

use gpui::{Decorations, Styled, TitlebarOptions, Window, point, px};
use gpui_component::TitleBar;

use crate::theme;

const TITLE_BAR_HEIGHT: f32 = 32.;
/// macOS's traffic lights are 16px tall with their hit area; this centres them in the bar and keeps
/// gpui-component's 9px left inset, which its 80px left padding is sized for.
const TRAFFIC_LIGHTS_LEFT: f32 = 9.;
const TRAFFIC_LIGHTS_HEIGHT: f32 = 16.;

/// The system title bar's options: hidden behind ours, with macOS's buttons placed on our bar.
pub fn titlebar_options(title: &str) -> TitlebarOptions {
	TitlebarOptions {
		title: Some(title.to_owned().into()),
		appears_transparent: true,
		traffic_light_position: Some(point(
			px(TRAFFIC_LIGHTS_LEFT),
			px((TITLE_BAR_HEIGHT - TRAFFIC_LIGHTS_HEIGHT) / 2.),
		)),
	}
}

/// Whether the window shows our title bar. macOS and Windows always hide the system's; on Linux the
/// compositor decides, and a server-decorated window (an X11 session without a compositor, or a
/// Wayland compositor that insists) already has the system's bar, so ours would be a second one.
pub fn is_drawn(window: &Window) -> bool {
	cfg!(not(target_os = "linux"))
		|| matches!(window.window_decorations(), Decorations::Client { .. })
}

/// How far the bar reaches down the window; 0 when the system draws its own above the window.
pub fn height(window: &Window) -> gpui::Pixels {
	if is_drawn(window) {
		px(TITLE_BAR_HEIGHT)
	} else {
		px(0.)
	}
}

/// The bar itself. gpui-component's `TitleBar` drags the window, maximises on double click, opens
/// the window menu on right click on Linux, and draws the minimise, maximise and close buttons the
/// window manager supports on Linux and Windows.
pub fn title_bar() -> TitleBar {
	TitleBar::new()
		.h(px(TITLE_BAR_HEIGHT))
		.bg(theme::color(theme::PANEL))
		.border_0()
}
