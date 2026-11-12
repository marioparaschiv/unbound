//! The window: Unbound's sidebar of pages on the left, the open page on the right. Pages are the
//! React component tree, the native view tree and one per `ubd` command, grouped as `commands::nav`
//! says.

use std::collections::HashMap;

use gpui::{
	App, Context, Entity, Focusable, Global, KeyBinding, SharedString, Task, WeakEntity, Window,
	actions, div, linear_color_stop, linear_gradient, prelude::*, px,
};
use gpui_component::sidebar::Sidebar;
use unbound_devtools_core::Devtools;
use unbound_devtools_core::ubd::{self, Catalog, Launcher};

use crate::app::{Workspace, on_runtime};
use crate::commands::{CommandPage, nav};
use crate::empty_state::EmptyState;
use crate::explorer::classes::ClassBrowser;
use crate::link::DebuggerLink;
use crate::nav_list::{NavGroup, NavRow};
use crate::settings_dialog::{self, Closed, SettingsDialog};
use crate::title_bar::{self, title_bar};
use crate::view_finder::ViewFinder;
use crate::widgets::{Raised, footer_bar, icon_button, page_header, raised_button, tooltip};
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Page {
	Components,
	Views,
	Classes,
	Command(String),
}

enum CatalogState {
	Loading,
	Ready(Catalog),
	Failed(String),
}

pub struct Shell {
	devtools: Devtools,
	workspace: Entity<Workspace>,
	views: Entity<ViewFinder>,
	classes: Entity<ClassBrowser>,
	link: Entity<DebuggerLink>,
	page: Page,
	catalog: CatalogState,
	pages: HashMap<String, Entity<CommandPage>>,
	/// Open, or playing its exit motion; dropped once that ends.
	settings: Option<Entity<SettingsDialog>>,
	/// The CLI and folder the catalog came from; a change to either reloads it.
	source: (String, String),
	_load: Option<Task<()>>,
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
			cx.observe_global_in::<settings::Store>(window, |this, window, cx| {
				appearance::apply(Some(window), cx);
				this.reload_if_changed(cx);
			}),
			cx.observe_window_appearance(window, |_, window, cx| {
				appearance::apply(Some(window), cx);
			}),
		];
		let views = cx.new(|cx| ViewFinder::new(devtools.clone(), window, cx));
		let classes = cx.new(|cx| ClassBrowser::new(devtools.clone(), window, cx));
		let mut this = Self {
			devtools,
			workspace,
			views,
			classes,
			link,
			page: Page::Components,
			catalog: CatalogState::Loading,
			pages: HashMap::new(),
			settings: None,
			source: Default::default(),
			_load: None,
			_subscriptions: subscriptions,
		};
		this.load_catalog(cx);
		cx.set_global(Host(cx.entity().downgrade()));
		this
	}

	fn current_source(cx: &App) -> (String, String) {
		let settings = settings::get(cx);
		(settings.cli_command.clone(), settings.project_dir.clone())
	}

	fn reload_if_changed(&mut self, cx: &mut Context<Self>) {
		if Self::current_source(cx) != self.source {
			self.load_catalog(cx);
		}
	}

	fn load_catalog(&mut self, cx: &mut Context<Self>) {
		self.source = Self::current_source(cx);
		self.catalog = CatalogState::Loading;
		let Some(launcher) = Launcher::resolve(&self.source.0) else {
			self.catalog = CatalogState::Failed("Set how to run ubd in Settings.".into());
			cx.notify();
			return;
		};
		let cwd = settings::get(cx).working_dir();
		let request = on_runtime(&self.devtools, async move {
			ubd::load_catalog(&launcher, cwd).await
		});
		self._load = Some(cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				this.catalog = match result {
					Some(Ok(catalog)) => CatalogState::Ready(catalog),
					Some(Err(error)) => {
						tracing::warn!("Failed to load the ubd catalog: {error}");
						CatalogState::Failed(error.to_string())
					}
					None => CatalogState::Failed("Loading the commands was cancelled.".into()),
				};
				// A page built from the old catalog may show fields the new CLI dropped.
				this.pages.clear();
				cx.notify();
			})
			.ok();
		}));
		cx.notify();
	}

	pub fn open(&mut self, page: Page, window: &mut Window, cx: &mut Context<Self>) {
		// The old page's focused element leaves the tree with it, so the new page takes focus and
		// its shortcuts (run, stop) work without a click first.
		if let Page::Command(name) = &page
			&& let Some(command) = self.command_page(name, window, cx)
		{
			window.focus(&command.focus_handle(cx), cx);
		}
		if self.page == Page::Views && page != Page::Views {
			self.views.update(cx, |views, _| views.clear_highlight());
		}
		if page == Page::Views {
			self.views.update(cx, |views, cx| views.open(cx));
		}
		if page == Page::Classes {
			self.classes.update(cx, |classes, cx| classes.open(cx));
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

	fn command_page(
		&mut self,
		name: &str,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Option<Entity<CommandPage>> {
		if let Some(page) = self.pages.get(name) {
			return Some(page.clone());
		}
		let CatalogState::Ready(catalog) = &self.catalog else {
			return None;
		};
		let spec = catalog.get(name)?.clone();
		let runtime = self.devtools.runtime();
		let page = cx.new(|cx| CommandPage::new(spec, runtime, window, cx));
		// The sidebar marks a running command, so it repaints when a page does.
		cx.observe(&page, |_, _, cx| cx.notify()).detach();
		self.pages.insert(name.to_owned(), page.clone());
		Some(page)
	}

	fn row(&self, page: Page, label: String, icon: &'static str, cx: &App) -> NavRow {
		let running = match &page {
			Page::Command(name) => self
				.pages
				.get(name)
				.is_some_and(|page| page.read(cx).is_running()),
			Page::Components | Page::Views | Page::Classes => false,
		};
		NavRow {
			active: self.page == page,
			page,
			label: label.into(),
			icon,
			running,
		}
	}

	/// `framed`: the page panel has a top border under the title bar, which the sidebar matches.
	fn render_sidebar(&self, framed: bool, cx: &mut Context<Self>) -> impl IntoElement {
		let shell = cx.entity().downgrade();
		let commands = match &self.catalog {
			CatalogState::Ready(catalog) => nav::group(catalog),
			_ => vec![(nav::COMPONENTS_GROUP, Vec::new())],
		};
		let groups: Vec<NavGroup> = commands
			.into_iter()
			.enumerate()
			.map(|(ix, (title, commands))| {
				// Components and View Tree head their group; the trees are the first things to inspect.
				let trees = (title == nav::COMPONENTS_GROUP).then(|| {
					[
						self.row(
							Page::Components,
							"Components".into(),
							"icons/component.svg",
							cx,
						),
						self.row(Page::Views, nav::VIEWS_TITLE.into(), "icons/layers.svg", cx),
						self.row(
							Page::Classes,
							nav::CLASSES_TITLE.into(),
							"icons/library.svg",
							cx,
						),
					]
				});
				let rows = trees
					.into_iter()
					.flatten()
					.chain(commands.into_iter().map(|command| {
						self.row(
							Page::Command(command.name.clone()),
							nav::title(&command.name),
							nav::icon(&command.name),
							cx,
						)
					}))
					.collect();
				NavGroup {
					title,
					rows,
					first: ix == 0,
					shell: shell.clone(),
				}
			})
			.collect();
		let note = match &self.catalog {
			CatalogState::Ready(_) => None,
			CatalogState::Loading => Some(("Loading ubd commands", theme::TEXT_MUTED)),
			CatalogState::Failed(_) => Some(("ubd is unavailable", theme::ERROR)),
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
							.children(groups),
					)
					// Rows scrolling under the header or footer fade out instead of being cut at the border.
					// At rest each fade covers only the list's own padding.
					.child(scroll_fade(0.).top_0())
					.child(scroll_fade(180.).bottom_0()),
			)
			.children(note.map(|(text, color)| {
				div()
					.id("catalog-note")
					.flex_none()
					// The rows' inset and padding, so the note's edges and text line up with theirs.
					.mx(px(theme::INSET))
					.mb(px(8.))
					.px(px(theme::GUTTER - theme::INSET))
					.py(px(8.))
					.rounded(theme::RADIUS_CONTROL)
					.bg(theme::alpha(color, 0.1))
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(color))
					.cursor_pointer()
					.child(text)
					.on_click(cx.listener(|this, _, window, cx| {
						this.open(Page::Command(String::new()), window, cx)
					}))
			}))
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

	/// What a command page shows while the catalog loads, or why it could not. It keeps the page's
	/// header and footer, so their edges still meet the sidebar's, and lays out like the empty state.
	fn render_catalog_state(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let (icon, tone, title, body, error): (_, _, _, _, Option<SharedString>) =
			match &self.catalog {
				CatalogState::Loading => (
					"icons/terminal.svg",
					theme::TEXT_FAINT,
					"Loading ubd's Commands",
					"Asking the CLI what it can do.",
					None,
				),
				CatalogState::Failed(error) => (
					"icons/triangle-alert.svg",
					theme::ERROR,
					"Can't Run ubd",
					"Install it with bun add -g @unbound-app/cli, or point Settings at how you run it.",
					Some(error.clone().into()),
				),
				CatalogState::Ready(_) => (
					"icons/terminal.svg",
					theme::WARNING,
					"This Command Is Gone",
					"The CLI no longer offers it.",
					None,
				),
			};
		let failed = error.is_some();
		div()
			.size_full()
			.flex()
			.flex_col()
			.child(page_header("ubd", "Commands"))
			.child(
				EmptyState::new(icon, title)
					.tone(tone)
					.body(body)
					// The same chip as a command page's preview line, in the error colour.
					.children(error.map(|error| {
						div()
							.max_w_full()
							.px(px(10.))
							.py(px(6.))
							.rounded(theme::RADIUS_CONTROL)
							.bg(theme::color(theme::PANEL))
							.border_1()
							.border_color(theme::color(theme::BORDER))
							.font_family(theme::mono_font())
							.text_size(theme::TEXT_SMALL)
							.line_height(px(18.))
							.text_color(theme::color(theme::ERROR))
							.child(error)
					}))
					.when(failed, |column| {
						column.child(
							div()
								.flex()
								.gap(px(10.))
								.mt(px(8.))
								.child(
									raised_button(
										"retry",
										Raised::Secondary,
										None,
										"Try Again",
										true,
									)
									.on_click(cx.listener(|this, _, _, cx| this.load_catalog(cx))),
								)
								.child(
									raised_button(
										"open-settings",
										Raised::Primary,
										None,
										"Open Settings",
										true,
									)
									.on_click(cx.listener(|this, _, window, cx| {
										this.open_settings(&OpenSettings, window, cx)
									})),
								),
						)
					}),
			)
			.child(
				footer_bar().px(px(theme::GUTTER)).child(
					div()
						.min_w_0()
						.truncate()
						.child(format!("Runs {} in {}", self.source.0, self.source.1)),
				),
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
		let content = match self.page.clone() {
			Page::Components => self.workspace.clone().into_any_element(),
			Page::Views => self.views.clone().into_any_element(),
			Page::Classes => self.classes.clone().into_any_element(),
			Page::Command(name) => match self.command_page(&name, window, cx) {
				Some(page) => page.into_any_element(),
				None => self.render_catalog_state(cx).into_any_element(),
			},
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
