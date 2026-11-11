//! The sidebar's page list. gpui-component's `Sidebar` scrolls it; the rows are drawn here on the
//! app's own metrics (13px text, 14px icons, the 20px icon line) instead of its rem-sized menu.

use gpui::{App, FontWeight, SharedString, WeakEntity, Window, div, prelude::*, px, relative};
use gpui_component::Collapsible;
use gpui_component::sidebar::SidebarItem;

use crate::press::Pressable;
use crate::shell::{Page, Shell};
use crate::theme;
use crate::widgets::{eyebrow, icon};

const ROW_HEIGHT: f32 = 28.;
/// The sidebar insets its list by 12px; 8 more puts icons and labels on the window's 20px line.
const ROW_INSET: f32 = 8.;
/// Lets a row's scaled face answer hover over the row's whole, unscaled box.
const ROW_GROUP: &str = "nav-row";

/// One page in the list.
#[derive(Clone)]
pub struct NavRow {
	pub page: Page,
	pub label: SharedString,
	pub icon: &'static str,
	pub active: bool,
	/// The page's command is running; the row shows a dot.
	pub running: bool,
}

/// A titled run of rows. The sidebar lays groups out in a list, which ignores its own gap, so the
/// space above a group lives on the group.
#[derive(Clone)]
pub struct NavGroup {
	pub title: &'static str,
	pub rows: Vec<NavRow>,
	pub first: bool,
	pub shell: WeakEntity<Shell>,
}

// The sidebar never collapses (`collapsible(false)`), so the group has no collapsed form.
impl Collapsible for NavGroup {
	fn is_collapsed(&self) -> bool {
		false
	}

	fn collapsed(self, _: bool) -> Self {
		self
	}
}

impl SidebarItem for NavGroup {
	fn render(
		self,
		id: impl Into<gpui::ElementId>,
		_: &mut Window,
		_: &mut App,
	) -> impl IntoElement {
		let id: gpui::ElementId = id.into();
		let shell = self.shell;
		div()
			.id(id)
			.flex()
			.flex_col()
			.when(!self.first, |group| group.pt(px(12.)))
			.child(
				div()
					.h(px(ROW_HEIGHT))
					.flex()
					.items_center()
					.px(px(ROW_INSET))
					.child(eyebrow(self.title)),
			)
			.children(self.rows.into_iter().enumerate().map(move |(ix, row)| {
				let shell = shell.clone();
				render_row(ix, row, shell)
			}))
	}
}

fn render_row(ix: usize, row: NavRow, shell: WeakEntity<Shell>) -> impl IntoElement {
	let (text, glyph) = if row.active {
		(theme::TEXT, theme::TEXT)
	} else {
		(theme::TEXT_SECONDARY, theme::TEXT_MUTED)
	};
	let NavRow {
		page,
		label,
		icon: path,
		active,
		running,
	} = row;
	// The row keeps its box in the list; the face inside is drawn at `scale`, every length
	// multiplied, so a press shrinks text and icon about the centre like the web's `scale`.
	let face = move |scale: f32| {
		let inset = relative((1. - scale) / 2.);
		div()
			.absolute()
			.top(inset)
			.bottom(inset)
			.left(inset)
			.right(inset)
			.flex()
			.items_center()
			.gap(px(8. * scale))
			.px(px(ROW_INSET * scale))
			.rounded(theme::RADIUS_ITEM * scale)
			.text_size(theme::TEXT_UI * scale)
			.text_color(theme::color(text))
			.map(|item| {
				if active {
					item.bg(theme::color(theme::HOVER))
						.font_weight(FontWeight::MEDIUM)
				} else {
					item.group_hover(ROW_GROUP, |item| {
						item.bg(theme::alpha(theme::HOVER, 0.6))
							.text_color(theme::color(theme::TEXT))
					})
				}
			})
			.child(icon(path, theme::ICON * scale, glyph))
			.child(div().flex_1().min_w_0().truncate().child(label))
			.when(running, |item| {
				item.child(
					div()
						.flex_none()
						.size(px(6. * scale))
						.rounded_full()
						.bg(theme::color(theme::WARNING)),
				)
			})
			.into_any_element()
	};
	let body = div().h(px(ROW_HEIGHT)).group(ROW_GROUP).cursor_pointer();
	Pressable::flat(ix, body, face).on_click(move |_, window, cx| {
		shell
			.update(cx, |shell, cx| shell.open(page.clone(), window, cx))
			.ok();
	})
}
