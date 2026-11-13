//! The Unbound debugger bridge, served by this app so it needs no `ubd`: the device dials it
//! plainly, controllers with `?mcp`, and [`router`] routes between them. It speaks the protocol of
//! `@unbound-app/debugger`'s bridge, so either serves the other's tools.

pub(crate) mod advertise;
mod requests;
pub(crate) mod router;

use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};

use crate::bridge::BridgeInfo;
use router::{ConnId, Event, Flow, Outgoing, Role, Router};

/// `CONTROLLER_ENDPOINT_MARKER` in the protocol.
const CONTROLLER_ENDPOINT_MARKER: &str = "mcp";

/// Listens on every interface, so a phone on the network can dial it, and advertises over Bonjour
/// so the phone finds it, until no controller has been attached for `idle_timeout`; `None` serves
/// until the process ends.
pub async fn run(port: u16, idle_timeout: Option<Duration>) -> std::io::Result<()> {
	let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port))).await?;

	tracing::info!("Debugger bridge listening on port {port}");

	let (info, advertiser) = advertise::start(port).await;

	serve_with(listener, idle_timeout, Some(info)).await;
	tracing::info!("No controller attached for a while, exiting");

	if let Some(advertiser) = advertiser {
		advertiser.stop().await;
	}

	Ok(())
}

/// Serves the bridge on `listener` until it idles out, without advertising it.
pub async fn serve(listener: TcpListener, idle_timeout: Option<Duration>) {
	serve_with(listener, idle_timeout, None).await;
}

/// Serves the bridge, telling each controller `info` (`bridge-info`) when it attaches.
async fn serve_with(
	listener: TcpListener,
	idle_timeout: Option<Duration>,
	info: Option<BridgeInfo>,
) {
	let (events, mut inbox) = mpsc::unbounded_channel();
	let mut router = Router::new(events.clone(), idle_timeout, info);
	let mut next_conn: ConnId = 0;

	loop {
		tokio::select! {
			accepted = listener.accept() => {
				let Ok((stream, _)) = accepted else {
					continue;
				};

				next_conn += 1;
				tokio::spawn(connection(stream, next_conn, events.clone()));
			}
			Some(event) = inbox.recv() => {
				if router.handle(event) == Flow::Exit {
					return;
				}
			}
		}
	}
}

/// One socket: its frames go to the router, and the router's go out on it.
// tungstenite's handshake callback fixes its error type; the closure never returns one.
#[allow(clippy::result_large_err)]
async fn connection(stream: TcpStream, conn: ConnId, events: mpsc::UnboundedSender<Event>) {
	let mut role = Role::Device;
	let handshake =
		tokio_tungstenite::accept_hdr_async(stream, |request: &Request, response: Response| {
			if is_controller(request.uri().query()) {
				role = Role::Controller;
			}

			Ok(response)
		})
		.await;

	// Port probes, such as a tool checking whether a bridge listens, connect and close without a handshake.
	let Ok(socket) = handshake else {
		return;
	};

	let (mut sink, mut source) = socket.split();
	let (tx, mut outbox) = mpsc::unbounded_channel();

	if events.send(Event::Open { conn, role, tx }).is_err() {
		return;
	}

	loop {
		tokio::select! {
			message = source.next() => match message {
				Some(Ok(Message::Text(text))) => {
					let _ = events.send(Event::Text { conn, text: text.to_string() });
				}
				Some(Ok(Message::Close(_)) | Err(_)) | None => break,
				Some(Ok(_)) => {}
			},
			outgoing = outbox.recv() => match outgoing {
				Some(Outgoing::Text(text)) => {
					if sink.send(Message::text(text)).await.is_err() {
						break;
					}
				}
				Some(Outgoing::Close) | None => {
					let _ = sink.close().await;
					break;
				}
			},
		}
	}

	let _ = events.send(Event::Close { conn });
}

fn is_controller(query: Option<&str>) -> bool {
	query.is_some_and(|query| {
		query
			.split('&')
			.any(|pair| pair.split('=').next() == Some(CONTROLLER_ENDPOINT_MARKER))
	})
}
