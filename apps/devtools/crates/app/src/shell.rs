//! The window: Unbound's sidebar of pages on the left, the open page on the right. The pages are
//! the React component tree, the native view tree and the Metro module explorer.

use gpui::{
	App, Context, Entity, Focusable, Global, KeyBinding, WeakEntity, Window, actions, div,
	linear_color_stop, linear_gradient, prelude::*, px,
};
use gpui_component::sidebar::Sidebar;
use unbound_devtools_core::Devtools;

use crate::app::Workspace;
use crate::link::DebuggerLink;
use crate::metro::MetroBrowser;
use crate::nav;
use crate::nav_list::{NavGroup, NavRow};
use crate::settings_dialog::{self, Closed, SettingsDialog};
use crate::title_bar::{self, title_bar};
use crate::view_finder::ViewFinder;
use crate::widgets::{icon_button, tooltip};
use crate::{appearance, settings, theme};

actions!(shell, [OpenSettings]);

/// The window's shell, so the global settings shortcut can reach it with nothing focused.
struct Host(WeakEntity<Shell>);

impl Global for Host {}

pub fn bind_keys(cx: &mut App) {
	let open = if cfg!(target_os = "macos") {
		"cmd-,"
	} else {
		"ctrl-,"
	};
	cx.bind_keys([KeyBinding::new(open, OpenSettings, None)]);
	settings_dialog::bind_keys(cx);
	// Global, so the shortcut works even when nothing in the window has focus yet.
	cx.on_action(|_: &OpenSettings, cx| {
		// Without a window manager (or before activation) no window is active; there is only one.
		if let Some(window) = cx.active_window().or_else(|| cx.windows().first().copied()) {
			// Deferred: the window is still dispatching this keystroke, so it can't be updated yet.
			cx.defer(move |cx| {
				let Some(shell) = cx.try_global::<Host>().and_then(|host| host.0.upgrade()) else {
					return;
				};
				window
					.update(cx, |_, window, cx| {
						shell.update(cx, |shell, cx| {
							shell.open_settings(&OpenSettings, window, cx)
						})
					})
					.ok();
			});
		}
	});
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Page {
	Components,
	Views,
	Metro,
}

pub struct Shell {
	workspace: Entity<Workspace>,
	views: Entity<ViewFinder>,
	metro: Entity<MetroBrowser>,
	link: Entity<DebuggerLink>,
	page: Page,
	/// Open, or playing its exit motion; dropped once that ends.
	settings: Option<Entity<SettingsDialog>>,
	_subscriptions: Vec<gpui::Subscription>,
}

impl Shell {
	pub fn new(
		devtools: Devtools,
		workspace: Entity<Workspace>,
		link: Entity<DebuggerLink>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Self {
		let subscriptions = vec![
			cx.observe_global_in::<settings::Store>(window, |_, window, cx| {
				appearance::apply(Some(window), cx);
			}),
			cx.observe_window_appearance(window, |_, window, cx| {
				appearance::apply(Some(window), cx);
			}),
		];
		let views = cx.new(|cx| ViewFinder::new(devtools.clone(), window, cx));
		let metro = cx.new(|cx| MetroBrowser::new(devtools, window, cx));
		let this = Self {
			workspace,
			views,
			metro,
			link,
			page: Page::Components,
			settings: None,
			_subscriptions: subscriptions,
		};
		cx.set_global(Host(cx.entity().downgrade()));
		this
	}

	pub fn open(&mut self, page: Page, cx: &mut Context<Self>) {
		if self.page == Page::Views && page != Page::Views {
			self.views.update(cx, |views, _| views.clear_highlight());
		}
		if page == Page::Views {
			self.views.update(cx, |views, cx| views.open(cx));
		}
		if page == Page::Metro {
			self.metro.update(cx, |metro, cx| metro.open(cx));
		}
		self.page = page;
		cx.notify();
	}

	fn open_settings(&mut self, _: &OpenSettings, window: &mut Window, cx: &mut Context<Self>) {
		if self
			.settings
			.as_ref()
			.is_some_and(|dialog| !dialog.read(cx).is_closing())
		{
			return;
		}
		let dialog = cx.new(|cx| SettingsDialog::new(window, cx));
		cx.subscribe(&dialog, |this, closed, _: &Closed, cx| {
			// A newer dialog may have opened during this one's exit.
			if this.settings.as_ref() == Some(&closed) {
				this.settings = None;
				cx.notify();
			}
		})
		.detach();
		window.focus(&dialog.focus_handle(cx), cx);
		self.settings = Some(dialog);
		cx.notify();
	}

	fn row(&self, page: Page, label: &'static str, icon: &'static str) -> NavRow {
		NavRow {
			active: self.page == page,
			page,
			label: label.into(),
			icon,
		}
	}

	/// `framed`: the page panel has a top border under the title bar, which the sidebar matches.
	fn render_sidebar(&self, framed: bool, cx: &mut Context<Self>) -> impl IntoElement {
		let shell = cx.entity().downgrade();
		let group = NavGroup {
			title: nav::COMPONENTS_GROUP,
			rows: vec![
				self.row(
					Page::Components,
					nav::COMPONENTS_TITLE,
					"icons/component.svg",
				),
				self.row(Page::Views, nav::VIEWS_TITLE, "icons/layers.svg"),
				self.row(Page::Metro, nav::METRO_TITLE, "icons/boxes.svg"),
			],
			first: true,
			shell,
		};
		div()
			.flex_none()
			.w(theme::SIDEBAR_WIDTH)
			.h_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::PANEL))
			// The page panel's top border, so the header's bottom border meets the page header's.
			.when(framed, |sidebar| sidebar.pt(px(1.)))
			// Whether Discord is connected, always in view at the top.
			.child(self.link.clone())
			.child(
				div()
					.relative()
					.flex_1()
					.min_h_0()
					.child(
						Sidebar::new("nav")
							.w_full()
							.border_0()
							.collapsible(false)
							.child(group),
					)
					// Rows scrolling under the header or footer fade out instead of being cut at the border.
					// At rest each fade covers only the list's own padding.
					.child(scroll_fade(0.).top_0())
					.child(scroll_fade(180.).bottom_0()),
			)
			.child(self.render_settings_row(cx))
	}

	/// Settings at the right edge behind a rule; the left stays free for future controls. The icon
	/// button pads its glyph by 6px, so the row pads 6px less to end it on the rows' gutter.
	fn render_settings_row(&self, cx: &mut Context<Self>) -> impl IntoElement {
		// The footer height, so its top border meets the pages' bottom bars in one line.
		div()
			.flex_none()
			.h(theme::FOOTER_HEIGHT)
			.flex()
			.items_center()
			.gap(px(8.))
			.pl(px(theme::GUTTER))
			.pr(px(theme::GUTTER - 6.))
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.child(div().flex_1())
			.child(
				div()
					.flex_none()
					.w(px(1.))
					.h(px(16.))
					.bg(theme::color(theme::BORDER)),
			)
			.child(
				icon_button("settings", "icons/settings.svg", false)
					.tooltip(tooltip("Settings"))
					.on_click(cx.listener(|this, _, window, cx| {
						this.open_settings(&OpenSettings, window, cx)
					})),
			)
	}
}

/// A strip that fades the panel colour in toward `angle` (0 is up), laid over a scrolling edge.
fn scroll_fade(angle: f32) -> gpui::Div {
	let panel = theme::hsla(theme::PANEL);
	div()
		.absolute()
		.left_0()
		.right_0()
		.h(px(12.))
		.bg(linear_gradient(
			angle,
			linear_color_stop(panel.opacity(0.), 0.),
			linear_color_stop(panel, 1.),
		))
}

impl Render for Shell {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let content = match self.page {
			Page::Components => self.workspace.clone().into_any_element(),
			Page::Views => self.views.clone().into_any_element(),
			Page::Metro => self.metro.clone().into_any_element(),
		};
		let framed = title_bar::is_drawn(window);
		div()
			.relative()
			.size_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::PANEL))
			.text_color(theme::color(theme::TEXT))
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_UI)
			.when(framed, |shell| shell.child(title_bar()))
			.child(
				div()
					.flex_1()
					.min_h_0()
					.flex()
					.child(self.render_sidebar(framed, cx))
					// The page is a panel tucked under the title bar and beside the sidebar, its top-left
					// corner rounded; its left border stands in for the sidebar's edge. Under the system's
					// title bar it meets the window's top edge, so it stays square there.
					.child(
						div()
							.flex_1()
							.min_w_0()
							.h_full()
							.overflow_hidden()
							.border_l_1()
							.when(framed, |panel| {
								panel.rounded_tl(theme::RADIUS_SURFACE).border_t_1()
							})
							.border_color(theme::color(theme::BORDER))
							.bg(theme::color(theme::APP))
							.child(content),
					),
			)
			.children(self.settings.clone())
	}
}
