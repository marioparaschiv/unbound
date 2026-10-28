//! The window's root view. It owns the view state (collapsed set, scroll, search, inspector) and
//! follows the core's revision counter; the core owns the tree and the selection.

use std::collections::HashSet;
use std::future::Future;
use std::rc::Rc;
use std::time::Duration;

use gpui::{
	App, Context, Entity, FocusHandle, Focusable, KeyBinding, MouseButton, MouseMoveEvent,
	MouseUpEvent, ScrollStrategy, Task, UniformListScrollHandle, Window, actions, div, prelude::*,
	px,
};
use unbound_devtools_core::{Config, Devtools, ElementId, Row, Status};

use crate::input::{self, TextInput};
use crate::inspection::Inspection;
use crate::search::Search;
use crate::theme;

actions!(
	tree,
	[
		SelectPrev,
		SelectNext,
		CollapseOrParent,
		ExpandOrChild,
		SelectFirst,
		SelectLast,
		FocusSearch
	]
);
actions!(search, [NextMatch, PrevMatch, ClearSearch]);

pub fn bind_keys(cx: &mut App) {
	input::bind_keys(cx);
	let tree = Some("Tree");
	let search = Some("Search");
	cx.bind_keys([
		KeyBinding::new("up", SelectPrev, tree),
		KeyBinding::new("down", SelectNext, tree),
		KeyBinding::new("left", CollapseOrParent, tree),
		KeyBinding::new("right", ExpandOrChild, tree),
		KeyBinding::new("home", SelectFirst, tree),
		KeyBinding::new("end", SelectLast, tree),
		KeyBinding::new("/", FocusSearch, tree),
		KeyBinding::new("enter", NextMatch, search),
		KeyBinding::new("shift-enter", PrevMatch, search),
		KeyBinding::new("escape", ClearSearch, search),
	]);
}

/// Runs a core future on the core's tokio runtime (its timeouts and sockets need the reactor) and
/// resolves on any executor. `None` when the runtime dropped the task.
pub fn on_runtime<T: Send + 'static, F: Future<Output = T> + Send + 'static>(
	devtools: &Devtools,
	future: F,
) -> impl Future<Output = Option<T>> + use<T, F> {
	let handle = devtools.runtime().spawn(future);
	async move { handle.await.ok() }
}

pub struct Workspace {
	pub devtools: Devtools,
	pub config: Config,
	pub status: Status,
	pub tree_focus: FocusHandle,
	pub collapsed: HashSet<ElementId>,
	pub rows: Rc<Vec<Row>>,
	pub scroll: UniformListScrollHandle,
	/// The selection this view last acted on; differs from the core's after an MCP `select`.
	pub selected: Option<ElementId>,
	pub search: Search,
	pub search_input: Entity<TextInput>,
	pub inspection: Option<Inspection>,
	pub folded_sections: HashSet<&'static str>,
	pub inspector_width: f32,
	pub resizing: bool,
	/// `react-native-renderer 19.2.3`, learned from the first inspection.
	pub renderer: Option<String>,
	pub connecting: bool,
	/// A transient error shown under the toolbar.
	pub banner: Option<String>,
	pub copied: bool,
	pub highlighted: Option<ElementId>,
	reinspect: Option<Task<()>>,
	banner_reset: Option<Task<()>>,
	copied_reset: Option<Task<()>>,
	_watch: Task<()>,
}

impl Workspace {
	pub fn new(
		devtools: Devtools,
		config: Config,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Self {
		let search_input =
			cx.new(|cx| TextInput::new("Search components   /   or jq: .name == \"View\"", cx));
		cx.subscribe(&search_input, |this, _, _: &input::Changed, cx| {
			this.query_changed(cx)
		})
		.detach();
		let watch = cx.spawn({
			let mut changes = devtools.changes();
			async move |this, cx| {
				while changes.changed().await.is_ok() {
					changes.borrow_and_update();
					if this
						.update(cx, |this, cx| this.revision_changed(cx))
						.is_err()
					{
						break;
					}
					// Coalesce bursts of operations into at most one update per frame.
					cx.background_executor()
						.timer(Duration::from_millis(16))
						.await;
				}
			}
		});
		let tree_focus = cx.focus_handle();
		window.focus(&tree_focus, cx);
		let mut this = Self {
			status: devtools.status(),
			devtools,
			config,
			tree_focus,
			collapsed: HashSet::new(),
			rows: Rc::default(),
			scroll: UniformListScrollHandle::new(),
			selected: None,
			search: Search::default(),
			search_input,
			inspection: None,
			folded_sections: HashSet::new(),
			inspector_width: theme::INSPECTOR_DEFAULT,
			resizing: false,
			renderer: None,
			connecting: false,
			banner: None,
			copied: false,
			highlighted: None,
			reinspect: None,
			banner_reset: None,
			copied_reset: None,
			_watch: watch,
		};
		this.revision_changed(cx);
		this
	}

	fn revision_changed(&mut self, cx: &mut Context<Self>) {
		let was_host = self.status.show_host_components;
		self.status = self.devtools.status();
		if was_host != self.status.show_host_components {
			// The backend remounts with new ids, so per-id view state is stale.
			self.collapsed.clear();
		}
		self.rebuild_rows();
		self.sync_selection(cx);
		self.search
			.schedule(self.devtools.clone(), Duration::from_millis(150), false, cx);
		if let Some(id) = self.selected {
			self.reinspect = Some(cx.spawn(async move |this, cx| {
				cx.background_executor()
					.timer(Duration::from_millis(150))
					.await;
				this.update(cx, |this, cx| this.inspect(id, cx)).ok();
			}));
		}
		cx.notify();
	}

	pub fn rebuild_rows(&mut self) {
		self.rows = Rc::new(self.devtools.store().rows(&self.collapsed));
	}

	pub fn row_index(&self, id: ElementId) -> Option<usize> {
		self.rows.iter().position(|row| row.id == id)
	}

	/// Moves the shared selection; the core tells MCP clients, this view follows immediately.
	pub fn select(&mut self, id: Option<ElementId>, cx: &mut Context<Self>) {
		self.devtools.select(id);
		self.sync_selection(cx);
		cx.notify();
	}

	fn sync_selection(&mut self, cx: &mut Context<Self>) {
		let selected = self.devtools.selected();
		if selected == self.selected {
			return;
		}
		self.selected = selected;
		self.reinspect = None;
		if self.highlighted.is_some() {
			self.highlighted = None;
			self.devtools.highlight(None);
		}
		let Some(id) = selected else {
			self.inspection = None;
			return;
		};
		self.reveal(id);
		self.inspection = Some(Inspection::new(id));
		self.inspect(id, cx);
	}

	/// Expands `id`'s ancestors and scrolls it into view.
	fn reveal(&mut self, id: ElementId) {
		let expanded = {
			let store = self.devtools.store();
			let ancestors: Vec<ElementId> = store.ancestors(id).map(|element| element.id).collect();
			ancestors
				.into_iter()
				.fold(false, |any, id| self.collapsed.remove(&id) | any)
		};
		if expanded {
			self.rebuild_rows();
		}
		if let Some(ix) = self.row_index(id) {
			self.scroll.scroll_to_item(ix, ScrollStrategy::Nearest);
		}
	}

	pub fn toggle(&mut self, id: ElementId, cx: &mut Context<Self>) {
		if !self.collapsed.remove(&id) {
			self.collapsed.insert(id);
		}
		self.rebuild_rows();
		cx.notify();
	}

	fn select_row(&mut self, ix: usize, cx: &mut Context<Self>) {
		let Some(row) = self.rows.get(ix).copied() else {
			return;
		};
		self.select(Some(row.id), cx);
		self.scroll.scroll_to_item(ix, ScrollStrategy::Nearest);
	}

	fn selected_row(&self) -> Option<(usize, Row)> {
		let id = self.selected?;
		let ix = self.row_index(id)?;
		Some((ix, self.rows[ix]))
	}

	fn select_prev(&mut self, _: &SelectPrev, _: &mut Window, cx: &mut Context<Self>) {
		let ix = self
			.selected_row()
			.map_or(0, |(ix, _)| ix.saturating_sub(1));
		self.select_row(ix, cx);
	}

	fn select_next(&mut self, _: &SelectNext, _: &mut Window, cx: &mut Context<Self>) {
		let ix = self
			.selected_row()
			.map_or(0, |(ix, _)| (ix + 1).min(self.rows.len().saturating_sub(1)));
		self.select_row(ix, cx);
	}

	fn select_first(&mut self, _: &SelectFirst, _: &mut Window, cx: &mut Context<Self>) {
		self.select_row(0, cx);
	}

	fn select_last(&mut self, _: &SelectLast, _: &mut Window, cx: &mut Context<Self>) {
		self.select_row(self.rows.len().saturating_sub(1), cx);
	}

	fn collapse_or_parent(&mut self, _: &CollapseOrParent, _: &mut Window, cx: &mut Context<Self>) {
		let Some((_, row)) = self.selected_row() else {
			return;
		};
		if row.has_children && row.expanded {
			self.toggle(row.id, cx);
			return;
		}
		let parent = self
			.devtools
			.store()
			.get(row.id)
			.and_then(|element| element.parent);
		if parent.is_some() {
			self.select(parent, cx);
		}
	}

	fn expand_or_child(&mut self, _: &ExpandOrChild, _: &mut Window, cx: &mut Context<Self>) {
		let Some((ix, row)) = self.selected_row() else {
			return;
		};
		if !row.has_children {
			return;
		}
		if !row.expanded {
			self.toggle(row.id, cx);
			return;
		}
		self.select_row(ix + 1, cx);
	}

	fn focus_search(&mut self, _: &FocusSearch, window: &mut Window, cx: &mut Context<Self>) {
		window.focus(&self.search_input.focus_handle(cx), cx);
	}

	fn query_changed(&mut self, cx: &mut Context<Self>) {
		let query = self.search_input.read(cx).text().to_string();
		self.search.set_query(query, self.devtools.clone(), cx);
	}

	pub fn step_match(&mut self, forward: bool, cx: &mut Context<Self>) {
		if let Some(id) = self.search.step(forward) {
			self.select(Some(id), cx);
		}
	}

	fn next_match(&mut self, _: &NextMatch, _: &mut Window, cx: &mut Context<Self>) {
		self.step_match(true, cx);
	}

	fn prev_match(&mut self, _: &PrevMatch, _: &mut Window, cx: &mut Context<Self>) {
		self.step_match(false, cx);
	}

	fn clear_search(&mut self, _: &ClearSearch, window: &mut Window, cx: &mut Context<Self>) {
		self.search_input
			.update(cx, |input, cx| input.clear(window, cx));
		window.focus(&self.tree_focus, cx);
	}

	pub fn set_show_host_components(&mut self, show: bool) {
		self.devtools.set_show_host_components(show);
	}

	pub fn connect_device(&mut self, cx: &mut Context<Self>) {
		if self.connecting {
			return;
		}
		self.connecting = true;
		let devtools = self.devtools.clone();
		let request = on_runtime(
			&self.devtools,
			async move { devtools.connect_device().await },
		);
		cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				this.connecting = false;
				match result {
					Some(Ok(_)) => cx.notify(),
					Some(Err(error)) => this.show_error(format!("Connect device: {error:#}"), cx),
					None => this.show_error("Connect device was cancelled.".into(), cx),
				}
			})
			.ok();
		})
		.detach();
		cx.notify();
	}

	pub fn show_error(&mut self, message: String, cx: &mut Context<Self>) {
		self.banner = Some(message);
		self.banner_reset = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(Duration::from_secs(6)).await;
			this.update(cx, |this, cx| {
				this.banner = None;
				cx.notify();
			})
			.ok();
		}));
		cx.notify();
	}

	pub fn copy_mcp_url(&mut self, cx: &mut Context<Self>) {
		let Some(url) = self.status.mcp_url.clone() else {
			return;
		};
		cx.write_to_clipboard(gpui::ClipboardItem::new_string(url));
		self.copied = true;
		self.copied_reset = Some(cx.spawn(async move |this, cx| {
			cx.background_executor()
				.timer(Duration::from_millis(1200))
				.await;
			this.update(cx, |this, cx| {
				this.copied = false;
				cx.notify();
			})
			.ok();
		}));
		cx.notify();
	}

	fn on_mouse_move(
		&mut self,
		event: &MouseMoveEvent,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		if !self.resizing {
			return;
		}
		let width = f32::from(window.viewport_size().width - event.position.x);
		self.inspector_width = width.clamp(theme::INSPECTOR_MIN, theme::INSPECTOR_MAX);
		cx.notify();
	}

	fn on_mouse_up(&mut self, _: &MouseUpEvent, _: &mut Window, _: &mut Context<Self>) {
		self.resizing = false;
	}

	fn render_body(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
		div()
			.flex()
			.flex_1()
			.min_h_0()
			.child(self.render_tree_panel(cx))
			.child(
				div()
					.id("divider")
					.w(px(5.))
					.mx(px(-2.))
					.h_full()
					.flex()
					.justify_center()
					.cursor_col_resize()
					.child(div().w(px(1.)).h_full().bg(theme::color(if self.resizing {
						theme::BORDER_STRONG
					} else {
						theme::BORDER
					})))
					.on_mouse_down(
						MouseButton::Left,
						cx.listener(|this, _, _, cx| {
							this.resizing = true;
							cx.notify();
						}),
					),
			)
			.child(self.render_inspector(cx))
	}
}

impl Render for Workspace {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let body = if self.devtools.store().is_empty() {
			self.render_empty(cx).into_any_element()
		} else {
			self.render_body(cx).into_any_element()
		};
		div()
			.size_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::APP))
			.text_color(theme::color(theme::TEXT))
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_UI)
			.on_mouse_move(cx.listener(Self::on_mouse_move))
			.on_mouse_up(MouseButton::Left, cx.listener(Self::on_mouse_up))
			.on_action(cx.listener(Self::select_prev))
			.on_action(cx.listener(Self::select_next))
			.on_action(cx.listener(Self::select_first))
			.on_action(cx.listener(Self::select_last))
			.on_action(cx.listener(Self::collapse_or_parent))
			.on_action(cx.listener(Self::expand_or_child))
			.on_action(cx.listener(Self::focus_search))
			.on_action(cx.listener(Self::next_match))
			.on_action(cx.listener(Self::prev_match))
			.on_action(cx.listener(Self::clear_search))
			.child(self.render_toolbar(window, cx))
			.child(body)
			.child(self.render_status(cx))
	}
}
