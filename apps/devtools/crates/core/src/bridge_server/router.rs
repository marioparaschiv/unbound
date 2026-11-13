//! The bridge's routing, as one task owning all state: the device, the controllers, the requests
//! in flight and the idle timer. Sockets and timers talk to it through [`Event`]s.

use std::collections::HashMap;
use std::time::Duration;

use serde_json::{Value as Json, json};
use tokio::sync::mpsc::UnboundedSender;

use super::requests::{Failure, Request};
use crate::bridge::{BridgeInfo, DeviceInfo};

/// `REACT_DEVTOOLS_SHUTDOWN_EVENT` in the protocol.
const REACT_DEVTOOLS_SHUTDOWN_EVENT: &str = "shutdown";

pub(crate) type ConnId = u64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Role {
	Device,
	Controller,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Outgoing {
	Text(String),
	Close,
}

pub(crate) type Sender = UnboundedSender<Outgoing>;

pub(crate) enum Event {
	Open {
		conn: ConnId,
		role: Role,
		tx: Sender,
	},
	Text {
		conn: ConnId,
		text: String,
	},
	Close {
		conn: ConnId,
	},
	Expire {
		id: String,
		token: u64,
	},
	Idle {
		token: u64,
	},
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Flow {
	Continue,
	Exit,
}

struct Device {
	conn: ConnId,
	tx: Sender,
	info: Option<DeviceInfo>,
}

struct Pending {
	origin: ConnId,
	request: Request,
	token: u64,
}

pub(crate) struct Router {
	events: UnboundedSender<Event>,
	idle_timeout: Option<Duration>,
	/// `bridge-info`, sent to each controller after its first `device-status`.
	info: Option<String>,
	device: Option<Device>,
	controllers: HashMap<ConnId, Sender>,
	/// The controller acting as the React DevTools frontend: the last one to send it a frame.
	frontend: Option<ConnId>,
	pending: HashMap<String, Pending>,
	next_token: u64,
	idle_token: u64,
}

impl Router {
	/// Arms the idle timer at once, so a bridge whose starter never connects still exits.
	pub(crate) fn new(
		events: UnboundedSender<Event>,
		idle_timeout: Option<Duration>,
		info: Option<BridgeInfo>,
	) -> Self {
		let mut router = Self {
			events,
			idle_timeout,
			info: info.map(|info| info_frame(&info).to_string()),
			device: None,
			controllers: HashMap::new(),
			frontend: None,
			pending: HashMap::new(),
			next_token: 0,
			idle_token: 0,
		};

		router.arm_idle();
		router
	}

	pub(crate) fn handle(&mut self, event: Event) -> Flow {
		match event {
			Event::Open {
				conn,
				role: Role::Device,
				tx,
			} => self.attach_device(conn, tx),
			Event::Open {
				conn,
				role: Role::Controller,
				tx,
			} => self.attach_controller(conn, tx),
			Event::Text { conn, text } => self.receive(conn, &text),
			Event::Close { conn } => self.close(conn),
			Event::Expire { id, token } => self.expire(&id, token),
			Event::Idle { token } => {
				if token == self.idle_token && self.controllers.is_empty() {
					return Flow::Exit;
				}
			}
		}

		Flow::Continue
	}

	/// A new device replaces the old one, so a relaunched app takes over from a socket that died
	/// without closing.
	fn attach_device(&mut self, conn: ConnId, tx: Sender) {
		if let Some(previous) = self.device.as_ref().map(|device| device.conn) {
			let previous_tx = self.device.as_ref().map(|device| device.tx.clone());

			self.detach_device(previous);

			if let Some(previous_tx) = previous_tx {
				let _ = previous_tx.send(Outgoing::Close);
			}
		}

		tracing::info!("Device connected");
		self.device = Some(Device {
			conn,
			tx,
			info: None,
		});
		self.broadcast_status();
	}

	/// Fails every request still out, so no controller waits on a device that left. Twin of
	/// [`Self::attach_device`].
	fn detach_device(&mut self, conn: ConnId) {
		if self
			.device
			.as_ref()
			.is_none_or(|device| device.conn != conn)
		{
			return;
		}

		tracing::info!("Device disconnected");
		self.device = None;

		for (id, pending) in std::mem::take(&mut self.pending) {
			self.answer(
				pending.origin,
				&pending.request.failure(&id, Failure::DeviceLeft),
			);
		}

		self.broadcast_status();
	}

	fn attach_controller(&mut self, conn: ConnId, tx: Sender) {
		let _ = tx.send(Outgoing::Text(self.status().to_string()));

		if let Some(info) = &self.info {
			let _ = tx.send(Outgoing::Text(info.clone()));
		}

		self.controllers.insert(conn, tx);
		self.idle_token += 1;
		tracing::info!("Controller connected, {} attached", self.controllers.len());
	}

	/// Drops the controller's requests unanswered and ends the device's React DevTools session if
	/// it was the frontend. Twin of [`Self::attach_controller`].
	fn detach_controller(&mut self, conn: ConnId) {
		self.controllers.remove(&conn);
		self.pending.retain(|_, pending| pending.origin != conn);

		if self.frontend == Some(conn) {
			self.frontend = None;
			self.send_to_device(
				&json!({ "type": "react-devtools", "event": REACT_DEVTOOLS_SHUTDOWN_EVENT })
					.to_string(),
			);
		}

		tracing::info!(
			"Controller disconnected, {} attached",
			self.controllers.len()
		);
		self.arm_idle();
	}

	fn close(&mut self, conn: ConnId) {
		if self.controllers.contains_key(&conn) {
			self.detach_controller(conn);
		} else {
			self.detach_device(conn);
		}
	}

	fn receive(&mut self, conn: ConnId, text: &str) {
		let Ok(frame) = serde_json::from_str::<Json>(text) else {
			tracing::warn!("Failed to parse a frame from connection {conn}");
			return;
		};

		if self.controllers.contains_key(&conn) {
			self.route_controller_frame(conn, &frame, text);
		} else if self
			.device
			.as_ref()
			.is_some_and(|device| device.conn == conn)
		{
			self.route_device_frame(&frame, text);
		}
	}

	fn route_controller_frame(&mut self, conn: ConnId, frame: &Json, text: &str) {
		match frame["type"].as_str() {
			Some("view-highlight") => self.send_to_device(text),
			Some("react-devtools") => {
				self.frontend = Some(conn);
				self.send_to_device(text);
			}
			_ => self.request(conn, frame, text),
		}
	}

	fn request(&mut self, conn: ConnId, frame: &Json, text: &str) {
		let (Some(request), Some(id)) = (Request::of(frame), frame["id"].as_str()) else {
			return;
		};

		let Some(device) = &self.device else {
			self.answer(conn, &request.failure(id, Failure::NoDevice));
			return;
		};

		let _ = device
			.tx
			.send(Outgoing::Text(request.forwarded(frame, text)));
		self.next_token += 1;

		let token = self.next_token;
		let events = self.events.clone();
		let expired = id.to_owned();
		let timeout = request.timeout();

		tokio::spawn(async move {
			tokio::time::sleep(timeout).await;
			let _ = events.send(Event::Expire { id: expired, token });
		});
		self.pending.insert(
			id.to_owned(),
			Pending {
				origin: conn,
				request,
				token,
			},
		);
	}

	fn route_device_frame(&mut self, frame: &Json, text: &str) {
		match frame["type"].as_str() {
			Some("react-devtools") => {
				if let Some(frontend) = self.frontend {
					self.send(frontend, text);
				}
			}
			Some("hello") => {
				let Ok(info) = serde_json::from_value::<DeviceInfo>(frame["device"].clone()) else {
					return;
				};

				tracing::info!(
					"Device identified: {}, Discord {}, loader {}, client {}",
					info.platform,
					info.discord_version,
					info.loader_version,
					info.client_version
				);

				if let Some(device) = &mut self.device {
					device.info = Some(info);
				}

				self.broadcast_status();
			}
			Some("log") if is_log(frame) => {
				for tx in self.controllers.values() {
					let _ = tx.send(Outgoing::Text(text.to_owned()));
				}
			}
			Some(kind) => self.settle(kind, frame, text),
			None => {}
		}
	}

	/// Routes a device's answer to the controller that asked, when it answers a request in flight
	/// with the type that request expects.
	fn settle(&mut self, kind: &str, frame: &Json, text: &str) {
		let Some(id) = frame["id"].as_str() else {
			return;
		};
		let answers = self
			.pending
			.get(id)
			.is_some_and(|pending| pending.request.result_type() == kind);

		if !answers {
			return;
		}

		if let Some(pending) = self.pending.remove(id) {
			self.send(pending.origin, text);
		}
	}

	fn expire(&mut self, id: &str, token: u64) {
		let current = self
			.pending
			.get(id)
			.is_some_and(|pending| pending.token == token);

		if !current {
			return;
		}

		if let Some(pending) = self.pending.remove(id) {
			self.answer(
				pending.origin,
				&pending.request.failure(id, Failure::TimedOut),
			);
		}
	}

	fn arm_idle(&mut self) {
		let Some(timeout) = self.idle_timeout.filter(|_| self.controllers.is_empty()) else {
			return;
		};

		self.idle_token += 1;

		let token = self.idle_token;
		let events = self.events.clone();

		tokio::spawn(async move {
			tokio::time::sleep(timeout).await;
			let _ = events.send(Event::Idle { token });
		});
	}

	/// `device-status`: `device` only once the device has said hello.
	fn status(&self) -> Json {
		match &self.device {
			Some(Device {
				info: Some(info), ..
			}) => {
				json!({ "type": "device-status", "connected": true, "device": info })
			}
			Some(_) => json!({ "type": "device-status", "connected": true }),
			None => json!({ "type": "device-status", "connected": false }),
		}
	}

	fn broadcast_status(&self) {
		let status = self.status().to_string();

		for tx in self.controllers.values() {
			let _ = tx.send(Outgoing::Text(status.clone()));
		}
	}

	fn send_to_device(&self, text: &str) {
		if let Some(device) = &self.device {
			let _ = device.tx.send(Outgoing::Text(text.to_owned()));
		}
	}

	fn send(&self, conn: ConnId, text: &str) {
		if let Some(tx) = self.controllers.get(&conn) {
			let _ = tx.send(Outgoing::Text(text.to_owned()));
		}
	}

	fn answer(&self, conn: ConnId, answer: &Json) {
		self.send(conn, &answer.to_string());
	}
}

/// `bridge-info`: `info` tagged with its frame type.
pub(crate) fn info_frame(info: &BridgeInfo) -> Json {
	let mut frame = json!({ "type": "bridge-info" });

	if let (Some(frame), Ok(Json::Object(fields))) =
		(frame.as_object_mut(), serde_json::to_value(info))
	{
		frame.extend(fields);
	}

	frame
}

/// The protocol's `log` shape: a level of 1, 2 or 3 and a string message.
fn is_log(frame: &Json) -> bool {
	matches!(frame["level"].as_u64(), Some(1..=3)) && frame["message"].is_string()
}
