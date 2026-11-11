//! The View Tree page: the device's native views as a tree, one level fetched per expand, and the
//! selected view's properties in cards. Hovering a row outlines its view on the device.

mod cards;
mod rows;

use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use std::time::Duration;

use gpui::{
	Context, ScrollHandle, SharedString, UniformListScrollHandle, Window, div, prelude::*, px,
};
use unbound_devtools_core::{Devtools, RequestError, ViewNode};

use crate::app::on_runtime;
use crate::commands::nav;
use crate::empty::SETUP_STEPS;
use crate::empty_state::EmptyState;
use crate::theme;
use crate::widgets::{Raised, footer_bar, page_header, page_header_end, raised_button, tooltip};

/// Device status changes come in bursts; one check per frame is plenty.
const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);

/// One parent's children as far as the device has answered; the `None` parent is the roots.
enum Children {
	Loading,
	Loaded(Vec<String>),
	Failed(String),
}

/// One line of the flattened tree.
#[derive(Clone)]
enum Row {
	View {
		id: String,
		depth: u32,
		expanded: bool,
	},
	/// A child level that is loading or failed, under the view that asked for it.
	Note {
		depth: u32,
		text: SharedString,
		error: bool,
	},
}

impl Row {
	fn depth(&self) -> u32 {
		match self {
			Row::View { depth, .. } | Row::Note { depth, .. } => *depth,
		}
	}
}

pub struct ViewFinder {
	devtools: Devtools,
	nodes: HashMap<String, ViewNode>,
	children: HashMap<Option<String>, Children>,
	expanded: HashSet<String>,
	rows: Rc<Vec<Row>>,
	selected: Option<String>,
	/// The row under the pointer, whose view the device outlines.
	hovered: Option<String>,
	/// Whether the debugger connection has a device on it.
	connected: bool,
	/// The page has been shown, so a device that connects gets its roots listed.
	opened: bool,
	/// Bumped whenever the roots are listed again; an answer from an older listing names stale ids.
	epoch: u64,
	scroll: UniformListScrollHandle,
	card_scroll: ScrollHandle,
	_watch: gpui::Task<()>,
}

impl ViewFinder {
	pub fn new(devtools: Devtools, cx: &mut Context<Self>) -> Self {
		let watch = cx.spawn({
			let mut changes = devtools.changes();
			async move |this, cx| {
				while changes.changed().await.is_ok() {
					changes.borrow_and_update();
					if this.update(cx, |this, cx| this.status_changed(cx)).is_err() {
						break;
					}
					cx.background_executor()
						.timer(CHANGE_COALESCING_FRAME)
						.await;
				}
			}
		});
		Self {
			connected: device_connected(&devtools),
			devtools,
			nodes: HashMap::new(),
			children: HashMap::new(),
			expanded: HashSet::new(),
			rows: Rc::default(),
			selected: None,
			hovered: None,
			opened: false,
			epoch: 0,
			scroll: UniformListScrollHandle::new(),
			card_scroll: ScrollHandle::new(),
			_watch: watch,
		}
	}

	/// Lists the roots the first time the page shows, or again after a failed listing.
	pub fn open(&mut self, cx: &mut Context<Self>) {
		self.opened = true;
		let listed = matches!(
			self.children.get(&None),
			Some(Children::Loading | Children::Loaded(_))
		);
		if self.connected && !listed {
			self.list_roots(cx);
		}
	}

	/// Clears the device's outline; the page is closing, so no row will see the pointer leave.
	pub fn clear_highlight(&mut self) {
		if self.hovered.take().is_some() {
			self.devtools.highlight_view(None);
		}
	}

	fn status_changed(&mut self, cx: &mut Context<Self>) {
		let connected = device_connected(&self.devtools);
		if connected == self.connected {
			return;
		}
		self.connected = connected;
		// A device that left or came back numbers its views afresh.
		self.reset();
		if connected && self.opened {
			self.list_roots(cx);
		}
		cx.notify();
	}

	fn reset(&mut self) {
		self.clear_highlight();
		self.epoch += 1;
		self.nodes.clear();
		self.children.clear();
		self.expanded.clear();
		self.selected = None;
		self.rebuild_rows();
	}

	fn list_roots(&mut self, cx: &mut Context<Self>) {
		self.reset();
		self.list(None, cx);
	}

	fn list(&mut self, parent: Option<String>, cx: &mut Context<Self>) {
		self.children.insert(parent.clone(), Children::Loading);
		self.rebuild_rows();
		let epoch = self.epoch;
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			let parent = parent.clone();
			async move { devtools.list_views(parent).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				if this.epoch == epoch {
					this.settle(parent, result, cx);
				}
			})
			.ok();
		})
		.detach();
		cx.notify();
	}

	fn settle(
		&mut self,
		parent: Option<String>,
		result: Option<Result<Vec<ViewNode>, RequestError>>,
		cx: &mut Context<Self>,
	) {
		let children = match result {
			Some(Ok(nodes)) => {
				let ids = nodes.iter().map(|node| node.id.clone()).collect();
				self.nodes
					.extend(nodes.into_iter().map(|node| (node.id.clone(), node)));
				Children::Loaded(ids)
			}
			Some(Err(error)) => {
				let parent_name = parent.as_deref().unwrap_or("roots");
				tracing::warn!("Failed to list the views under {parent_name}: {error}");
				Children::Failed(error.to_string())
			}
			None => Children::Failed("Listing the views was cancelled.".into()),
		};
		self.children.insert(parent, children);
		self.rebuild_rows();
		cx.notify();
	}

	fn toggle(&mut self, id: &str, cx: &mut Context<Self>) {
		if self.expanded.remove(id) {
			self.rebuild_rows();
			cx.notify();
			return;
		}
		self.expanded.insert(id.to_owned());
		let key = Some(id.to_owned());
		if matches!(self.children.get(&key), None | Some(Children::Failed(_))) {
			self.list(key, cx);
			return;
		}
		self.rebuild_rows();
		cx.notify();
	}

	fn select(&mut self, id: &str, cx: &mut Context<Self>) {
		self.selected = Some(id.to_owned());
		self.card_scroll.set_offset(gpui::point(px(0.), px(0.)));
		cx.notify();
	}

	/// Outlines the hovered row's view; leaving a row clears it unless another row took over.
	fn hover(&mut self, id: &str, hovered: bool, cx: &mut Context<Self>) {
		if hovered {
			self.hovered = Some(id.to_owned());
			self.devtools.highlight_view(Some(id));
		} else if self.hovered.as_deref() == Some(id) {
			self.clear_highlight();
		}
		cx.notify();
	}

	fn rebuild_rows(&mut self) {
		let mut rows = Vec::new();
		self.push_children(None, 0, &mut rows);
		self.rows = Rc::new(rows);
	}

	fn push_children(&self, parent: Option<&str>, depth: u32, rows: &mut Vec<Row>) {
		let note = |text: SharedString, error| Row::Note { depth, text, error };
		match self.children.get(&parent.map(str::to_owned)) {
			None => {}
			// The roots' loading and failure fill the whole page instead.
			Some(Children::Loading | Children::Failed(_)) if parent.is_none() => {}
			Some(Children::Loading) => rows.push(note("Loading".into(), false)),
			Some(Children::Failed(error)) => rows.push(note(error.clone().into(), true)),
			Some(Children::Loaded(ids)) => {
				for id in ids {
					let expanded = self.expanded.contains(id);
					rows.push(Row::View {
						id: id.clone(),
						depth,
						expanded,
					});
					if expanded {
						self.push_children(Some(id), depth + 1, rows);
					}
				}
			}
		}
	}

	fn render_state(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
		let (icon, tone, title, body, retry): (_, _, _, SharedString, _) = if !self.connected {
			(
				"icons/unplug.svg",
				theme::TEXT_FAINT,
				"No Device Connected",
				SETUP_STEPS.into(),
				false,
			)
		} else if let Some(Children::Failed(error)) = self.children.get(&None) {
			(
				"icons/triangle-alert.svg",
				theme::ERROR,
				"Can't List the Views",
				error.clone().into(),
				true,
			)
		} else {
			(
				"icons/layers.svg",
				theme::TEXT_FAINT,
				"Listing the Views",
				"Asking the device for its windows.".into(),
				false,
			)
		};
		EmptyState::new(icon, title)
			.tone(tone)
			.body(body)
			.when(retry, |state| {
				state.child(
					raised_button("retry-views", Raised::Secondary, None, "Try Again", true)
						.mt(px(8.))
						.on_click(cx.listener(|this, _, _, cx| this.list_roots(cx))),
				)
			})
			.into_any_element()
	}

	fn render_footer(&self) -> impl IntoElement {
		// Empty until there is something to report; the sidebar header already says what it waits for.
		let note = self.connected.then(|| {
			format!(
				"{} views listed. Hover a row to outline its view on the device.",
				self.nodes.len()
			)
		});
		footer_bar()
			.px(px(theme::GUTTER))
			.children(note.map(|note| div().min_w_0().truncate().child(note)))
	}
}

fn device_connected(devtools: &Devtools) -> bool {
	devtools
		.status()
		.link
		.is_some_and(|link| link.device.is_some())
}

impl Render for ViewFinder {
	fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let listed = matches!(self.children.get(&None), Some(Children::Loaded(_)));
		let body = if self.connected && listed {
			div()
				.flex_1()
				.min_h_0()
				.flex()
				.child(self.render_tree_panel(cx))
				.child(div().flex_none().w(px(1.)).bg(theme::color(theme::BORDER)))
				.child(self.render_properties(cx))
				.into_any_element()
		} else {
			self.render_state(cx)
		};
		let connected = self.connected;
		div()
			.size_full()
			.flex()
			.flex_col()
			.child(
				page_header(nav::COMPONENTS_GROUP, nav::VIEWS_TITLE).child(
					page_header_end().justify_end().child(
						raised_button(
							"refresh-views",
							Raised::Secondary,
							Some("icons/refresh-cw.svg"),
							"Refresh",
							connected,
						)
						.tooltip(tooltip("List the device's views again"))
						.when(connected, |button| {
							button.on_click(cx.listener(|this, _, _, cx| this.list_roots(cx)))
						}),
					),
				),
			)
			.child(body)
			.child(self.render_footer())
	}
}
