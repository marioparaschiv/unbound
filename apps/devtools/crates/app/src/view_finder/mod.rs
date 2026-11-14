//! The View Tree page: the device's native views as a tree, one page of a level fetched per expand or
//! "show more", and the selected view's properties in cards, read from the device on selection.
//! Hovering a row outlines its view on the device.

mod cards;
mod rows;

use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use std::time::Duration;

use gpui::{
	AnyElement, Context, Entity, SharedString, UniformListScrollHandle, Window, div, prelude::*, px,
};
use unbound_devtools_core::{
	Devtools, ExplorerTarget, LinkStatus, RequestError, VIEWS_PAGE_SIZE, ViewDetails, ViewNode,
	ViewPage,
};

use crate::app::on_runtime;
use crate::empty::no_device;
use crate::empty_state::EmptyState;
use crate::explorer::{Entry, Explorer, ExplorerHost};
use crate::mcp_menu::McpButton;
use crate::nav;
use crate::theme;
use crate::widgets::{Raised, footer_bar, page_header, page_header_end, raised_button, tooltip};

/// Device status changes come in bursts; one check per frame is plenty.
const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);

/// One parent's children as far as the device has answered; the `None` parent is the roots.
enum Children {
	Loading,
	Loaded(Level),
	Failed(String),
}

/// The pages of a level listed so far.
struct Level {
	ids: Vec<String>,
	/// How many children the parent has in all; `None` from a device that sends whole levels.
	total: Option<u32>,
	/// The next page, while it loads or after it failed.
	next: Option<Result<(), String>>,
}

impl Level {
	fn remaining(&self) -> u32 {
		self.total
			.map_or(0, |total| total.saturating_sub(self.ids.len() as u32))
	}
}

/// The selected view's properties as far as the device has answered.
pub(super) enum Details {
	Loading,
	Loaded(Rc<ViewDetails>),
	Failed(SharedString),
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
	/// The rest of a level past its listed pages; clicking lists the next page.
	More {
		parent: Option<String>,
		depth: u32,
		text: SharedString,
		loading: bool,
	},
}

impl Row {
	fn depth(&self) -> u32 {
		match self {
			Row::View { depth, .. } | Row::Note { depth, .. } | Row::More { depth, .. } => *depth,
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
	/// Each selected view's properties, read again on every selection; kept to show while it rereads.
	details: HashMap<String, Details>,
	/// The row under the pointer, whose view the device outlines.
	hovered: Option<String>,
	/// Whether the debugger connection has a device on it.
	connected: bool,
	/// The debugger connection, for the pairing state while no device is attached.
	link: Option<LinkStatus>,
	/// The page has been shown, so a device that connects gets its roots listed.
	opened: bool,
	/// Bumped whenever the roots are listed again; an answer from an older listing names stale ids.
	epoch: u64,
	scroll: UniformListScrollHandle,
	/// The details pane: the selected view's page, and the objects opened from it.
	explorer: Explorer,
	mcp: Entity<McpButton>,
	_watch: gpui::Task<()>,
}

impl ViewFinder {
	pub fn new(
		devtools: Devtools,
		mcp: Entity<McpButton>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Self {
		let mut explorer = Explorer::new(devtools.clone(), window, cx);
		let link = devtools.status().link;
		explorer.set_connected(device_connected(link.as_ref()), cx);
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
			connected: device_connected(link.as_ref()),
			link,
			devtools,
			nodes: HashMap::new(),
			children: HashMap::new(),
			expanded: HashSet::new(),
			rows: Rc::default(),
			selected: None,
			details: HashMap::new(),
			hovered: None,
			opened: false,
			epoch: 0,
			scroll: UniformListScrollHandle::new(),
			explorer,
			mcp,
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
		self.link = self.devtools.status().link;
		let connected = device_connected(self.link.as_ref());
		if connected == self.connected {
			// The pairing state shows the bridge's code and reachability, which change on their own.
			if !connected {
				cx.notify();
			}
			return;
		}
		self.connected = connected;
		// A device that left or came back numbers its views afresh; the explorer keeps its pages
		// and reads the current one again.
		self.reset();
		self.explorer.set_connected(connected, cx);
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
		self.details.clear();
		self.explorer.prelude_changed();
		self.rebuild_rows();
	}

	fn list_roots(&mut self, cx: &mut Context<Self>) {
		self.reset();
		self.list(None, cx);
	}

	/// Lists the first page of a level.
	fn list(&mut self, parent: Option<String>, cx: &mut Context<Self>) {
		self.children.insert(parent.clone(), Children::Loading);
		self.request_page(parent, 0, cx);
	}

	/// Lists the page after a level's listed ones.
	fn show_more(&mut self, parent: Option<String>, cx: &mut Context<Self>) {
		let Some(Children::Loaded(level)) = self.children.get_mut(&parent) else {
			return;
		};
		if level.next == Some(Ok(())) {
			return;
		}
		level.next = Some(Ok(()));
		let offset = level.ids.len() as u32;
		self.request_page(parent, offset, cx);
	}

	fn request_page(&mut self, parent: Option<String>, offset: u32, cx: &mut Context<Self>) {
		self.rebuild_rows();
		let epoch = self.epoch;
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			let parent = parent.clone();
			async move { devtools.list_views(parent, offset).await }
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
		result: Option<Result<ViewPage, RequestError>>,
		cx: &mut Context<Self>,
	) {
		let result = result.unwrap_or_else(|| {
			Err(RequestError::Device(
				"Listing the views was cancelled.".into(),
			))
		});
		if let Err(error) = &result {
			let parent_name = parent.as_deref().unwrap_or("roots");
			tracing::warn!("Failed to list the views under {parent_name}: {error}");
		}
		let level = match (self.children.remove(&parent), result) {
			// A later page joins the level; a failed one leaves it as listed, with the error.
			(Some(Children::Loaded(mut level)), Ok(page)) => {
				level
					.ids
					.extend(page.nodes.iter().map(|node| node.id.clone()));
				level.total = page.total;
				level.next = None;
				self.add_nodes(page.nodes);
				Children::Loaded(level)
			}
			(Some(Children::Loaded(mut level)), Err(error)) => {
				level.next = Some(Err(error.to_string()));
				Children::Loaded(level)
			}
			(_, Ok(page)) => {
				let ids = page.nodes.iter().map(|node| node.id.clone()).collect();
				self.add_nodes(page.nodes);
				Children::Loaded(Level {
					ids,
					total: page.total,
					next: None,
				})
			}
			(_, Err(error)) => Children::Failed(error.to_string()),
		};
		self.children.insert(parent, level);
		self.rebuild_rows();
		cx.notify();
	}

	fn add_nodes(&mut self, nodes: Vec<ViewNode>) {
		self.nodes
			.extend(nodes.into_iter().map(|node| (node.id.clone(), node)));
	}

	/// Reads a view's properties from the device, keeping the last ones on show until they arrive.
	fn read_details(&mut self, id: &str, cx: &mut Context<Self>) {
		if !matches!(self.details.get(id), Some(Details::Loaded(_))) {
			self.details.insert(id.to_owned(), Details::Loading);
		}
		let epoch = self.epoch;
		let id = id.to_owned();
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			let id = id.clone();
			async move { devtools.view_details(&id).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				if this.epoch != epoch {
					return;
				}
				let details = match result {
					Some(Ok(details)) => Details::Loaded(Rc::new(details)),
					Some(Err(error)) => {
						tracing::warn!("Failed to read view {id}: {error}");
						Details::Failed(error.to_string().into())
					}
					None => Details::Failed("Reading the view was cancelled.".into()),
				};
				this.details.insert(id, details);
				this.explorer.prelude_changed();
				cx.notify();
			})
			.ok();
		})
		.detach();
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
		// Selecting a view starts the explorer over at it; its class stands in if it is gone.
		let entry = Entry::new(
			ExplorerTarget::Node(id.to_owned()),
			self.nodes.get(id).map(|node| node.class_name.clone()),
		);
		self.explorer.reset(entry, cx);
		self.read_details(id, cx);
		self.explorer.prelude_changed();
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
			Some(Children::Loaded(level)) => {
				for id in &level.ids {
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
				let remaining = level.remaining();
				if remaining > 0 {
					let (text, loading) = match &level.next {
						Some(Ok(())) => ("Loading".to_owned(), true),
						Some(Err(error)) => (format!("{error} Click to try again."), false),
						None => (
							format!("Show {} more", remaining.min(VIEWS_PAGE_SIZE)),
							false,
						),
					};
					let text = if loading || level.next.is_some() {
						text
					} else {
						format!("{text} · {remaining} not listed")
					};
					rows.push(Row::More {
						parent: parent.map(str::to_owned),
						depth,
						text: text.into(),
						loading,
					});
				}
			}
		}
	}

	fn render_state(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
		if !self.connected {
			return no_device(self.link.as_ref()).into_any_element();
		}
		let (icon, tone, title, body, retry): (_, _, _, SharedString, _) =
			if let Some(Children::Failed(error)) = self.children.get(&None) {
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
			let count = self.nodes.len();
			let noun = if count == 1 { "view" } else { "views" };
			format!("{count} {noun} listed. Hover a row to outline its view on the device.")
		});
		// The MCP button pads its label by 8px, so the bar pads 8px less to end on the gutter.
		footer_bar()
			.pl(px(theme::GUTTER))
			.pr(px(theme::GUTTER - 8.))
			.child(div().flex_1().min_w_0().truncate().children(note))
			.child(self.mcp.clone())
	}
}

impl ExplorerHost for ViewFinder {
	fn explorer(&self) -> &Explorer {
		&self.explorer
	}

	fn explorer_mut(&mut self) -> &mut Explorer {
		&mut self.explorer
	}

	fn prelude(&self, _: &mut Window, _: &mut Context<Self>) -> Option<AnyElement> {
		self.view_cards()
	}
}

fn device_connected(link: Option<&LinkStatus>) -> bool {
	link.is_some_and(|link| link.device.is_some())
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
