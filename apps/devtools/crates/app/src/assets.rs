//! Images, icons and fonts compiled into the binary, so it runs from any directory. The icons are
//! Lucide (ISC, `assets/icons/LICENSE`) with the stroke raised to 2.25 so they stay crisp at 10 to
//! 14 px. The fonts are Inter and JetBrains Mono (SIL OFL 1.1, `assets/fonts/*-OFL.txt`).

use std::borrow::Cow;

use gpui::{App, AssetSource, SharedString};

pub const LOGO: &str = "logo.png";
pub const CHEVRON_RIGHT: &str = "icons/chevron-right.svg";
pub const CHEVRON_DOWN: &str = "icons/chevron-down.svg";
pub const CHEVRON_UP: &str = "icons/chevron-up.svg";
pub const SEARCH: &str = "icons/search.svg";
pub const X: &str = "icons/x.svg";
pub const COPY: &str = "icons/copy.svg";
pub const CROSSHAIR: &str = "icons/crosshair.svg";
pub const TERMINAL: &str = "icons/terminal.svg";
pub const PLUG: &str = "icons/plug.svg";
pub const LAYERS: &str = "icons/layers.svg";

const FONTS: &str = "fonts/";

const FILES: &[(&str, &[u8])] = &[
	(LOGO, include_bytes!("../../../../../assets/logo.png")),
	(
		CHEVRON_RIGHT,
		include_bytes!("../assets/icons/chevron-right.svg"),
	),
	(
		CHEVRON_DOWN,
		include_bytes!("../assets/icons/chevron-down.svg"),
	),
	(CHEVRON_UP, include_bytes!("../assets/icons/chevron-up.svg")),
	(SEARCH, include_bytes!("../assets/icons/search.svg")),
	(X, include_bytes!("../assets/icons/x.svg")),
	(COPY, include_bytes!("../assets/icons/copy.svg")),
	(CROSSHAIR, include_bytes!("../assets/icons/crosshair.svg")),
	(TERMINAL, include_bytes!("../assets/icons/terminal.svg")),
	(PLUG, include_bytes!("../assets/icons/plug.svg")),
	(LAYERS, include_bytes!("../assets/icons/layers.svg")),
	(
		"fonts/Inter-Regular.ttf",
		include_bytes!("../assets/fonts/Inter-Regular.ttf"),
	),
	(
		"fonts/Inter-Medium.ttf",
		include_bytes!("../assets/fonts/Inter-Medium.ttf"),
	),
	(
		"fonts/Inter-SemiBold.ttf",
		include_bytes!("../assets/fonts/Inter-SemiBold.ttf"),
	),
	(
		"fonts/JetBrainsMono-Regular.ttf",
		include_bytes!("../assets/fonts/JetBrainsMono-Regular.ttf"),
	),
	(
		"fonts/JetBrainsMono-Italic.ttf",
		include_bytes!("../assets/fonts/JetBrainsMono-Italic.ttf"),
	),
];

pub struct Assets;

impl AssetSource for Assets {
	fn load(&self, path: &str) -> gpui::Result<Option<Cow<'static, [u8]>>> {
		Ok(FILES
			.iter()
			.find(|(name, _)| *name == path)
			.map(|(_, bytes)| Cow::Borrowed(*bytes)))
	}

	fn list(&self, path: &str) -> gpui::Result<Vec<SharedString>> {
		Ok(FILES
			.iter()
			.filter(|(name, _)| name.starts_with(path))
			.map(|(name, _)| SharedString::from(*name))
			.collect())
	}
}

pub fn load_fonts(cx: &App) -> gpui::Result<()> {
	let source = cx.asset_source();
	let mut fonts = Vec::new();
	for path in source.list(FONTS)? {
		fonts.extend(source.load(&path)?);
	}
	cx.text_system().add_fonts(fonts)
}
