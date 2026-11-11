//! Light and dark: registers Unbound's gpui-component themes and keeps them, and the hand-drawn
//! panels' palette, on the appearance the settings ask for.

use std::rc::Rc;

use gpui::{App, Window, WindowAppearance};
use gpui_component::{Theme, ThemeMode, ThemeSet};

use crate::settings::{self, Appearance};
use crate::theme;

const THEMES: &str = include_str!("../assets/themes/unbound.json");

pub fn init(cx: &mut App) {
	gpui_component::init(cx);
	let themes = match serde_json::from_str::<ThemeSet>(THEMES) {
		Ok(themes) => themes.themes,
		Err(error) => {
			tracing::error!("Failed to read the bundled Unbound theme: {error}");
			return;
		}
	};
	let theme = Theme::global_mut(cx);
	for config in themes {
		if config.mode.is_dark() {
			theme.dark_theme = Rc::new(config);
		} else {
			theme.light_theme = Rc::new(config);
		}
	}
}

fn is_dark(appearance: WindowAppearance) -> bool {
	matches!(
		appearance,
		WindowAppearance::Dark | WindowAppearance::VibrantDark
	)
}

/// Applies the appearance in the settings; `System` follows the window.
pub fn apply(window: Option<&mut Window>, cx: &mut App) {
	let dark = match settings::get(cx).appearance {
		Appearance::Dark => true,
		Appearance::Light => false,
		Appearance::System => is_dark(
			window
				.as_ref()
				.map_or_else(|| cx.window_appearance(), |window| window.appearance()),
		),
	};
	theme::set_dark(dark);
	let mode = if dark {
		ThemeMode::Dark
	} else {
		ThemeMode::Light
	};
	Theme::change(mode, window, cx);
}
