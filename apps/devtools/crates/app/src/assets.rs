//! Images, icons and fonts compiled into the binary, so it runs from any directory. The icons are
//! Lucide (ISC, `assets/icons/LICENSE`) with the stroke raised to 2.25 so they stay crisp at 10 to
//! 14 px; any other `icons/<name>.svg` comes from gpui-kit-assets' full Lucide set. The fonts are
//! Geist, the website's font, and JetBrains Mono (SIL OFL 1.1, `assets/fonts/*-OFL.txt`).

use std::borrow::Cow;

use gpui::{App, AssetSource, SharedString};
use gpui_kit_assets::AllAssets;

pub const LOGO: &str = "logo.png";
pub const CHEVRON_RIGHT: &str = "icons/chevron-right.svg";
pub const CHEVRON_DOWN: &str = "icons/chevron-down.svg";
pub const CHEVRON_UP: &str = "icons/chevron-up.svg";
pub const SEARCH: &str = "icons/search.svg";
pub const X: &str = "icons/x.svg";
pub const COPY: &str = "icons/copy.svg";
pub const ARROW_UP_RIGHT: &str = "icons/arrow-up-right.svg";
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
		"fonts/Geist-Regular.ttf",
		include_bytes!("../assets/fonts/Geist-Regular.ttf"),
	),
	(
		"fonts/Geist-Medium.ttf",
		include_bytes!("../assets/fonts/Geist-Medium.ttf"),
	),
	(
		"fonts/Geist-SemiBold.ttf",
		include_bytes!("../assets/fonts/Geist-SemiBold.ttf"),
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
		match FILES.iter().find(|(name, _)| *name == path) {
			Some((_, bytes)) => Ok(Some(Cow::Borrowed(*bytes))),
			None => AllAssets.load(path),
		}
	}

	fn list(&self, path: &str) -> gpui::Result<Vec<SharedString>> {
		let mut names: Vec<SharedString> = FILES
			.iter()
			.filter(|(name, _)| name.starts_with(path))
			.map(|(name, _)| SharedString::from(*name))
			.collect();
		if !path.starts_with(FONTS) {
			names.extend(AllAssets.list(path)?);
		}
		Ok(names)
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
