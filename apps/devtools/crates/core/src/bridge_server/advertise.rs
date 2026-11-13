//! Bonjour (mDNS) advertising, so a phone on the same network finds the bridge without an address.
//! `mdns-sd` runs its own responder on UDP 5353, shared with the system's (Apple's, Avahi, Windows'
//! DNS Client) through `SO_REUSEADDR`, so the same code works on macOS, Linux and Windows.

use std::net::{IpAddr, Ipv4Addr};
use std::time::Duration;

use mdns_sd::{DaemonEvent, IfKind, ServiceDaemon, ServiceInfo, UnregisterStatus};

use crate::bridge::BridgeInfo;
use crate::device_address;

/// `BRIDGE_SERVICE_TYPE` in the protocol.
pub(crate) const BRIDGE_SERVICE_TYPE: &str = "_unbound-bridge._tcp";
/// `BRIDGE_SERVICE_PROTOCOL` in the protocol.
pub(crate) const BRIDGE_SERVICE_PROTOCOL: &str = "1";
/// The `by` TXT value: the phone says DevTools is open on this computer.
const ADVERTISED_BY: &str = "devtools";
/// The responder announces within milliseconds; none by then means no interface took it.
const ANNOUNCE_WAIT: Duration = Duration::from_secs(2);
/// What usually blocks mDNS on this OS, and how to allow it.
pub(crate) const FIREWALL_HINT: &str = if cfg!(windows) {
	"A firewall or the network's Public profile is likely blocking mDNS: set the network to Private, or allow Unbound DevTools through Windows Defender Firewall."
} else if cfg!(target_os = "macos") {
	"A firewall or VPN is likely blocking mDNS: allow Unbound DevTools in System Settings > Network > Firewall."
} else {
	"A firewall or VPN is likely blocking mDNS: allow UDP port 5353, for example with ufw allow 5353/udp."
};
/// Long enough for the goodbye packets, which tell phones the bridge left.
const UNREGISTER_WAIT: Duration = Duration::from_secs(1);

/// A running advertisement; [`Advertiser::stop`] withdraws it.
pub(crate) struct Advertiser {
	daemon: ServiceDaemon,
	fullname: String,
}

/// Advertises the bridge on `port` over the LAN interface only. Returns what controllers are told,
/// and the advertiser while it runs; a failure is named in the info rather than raised.
pub(crate) async fn start(port: u16) -> (BridgeInfo, Option<Advertiser>) {
	let code = pairing_code();
	let lan = device_address::lan_interface(
		device_address::route_address(),
		device_address::interfaces(),
	);
	let info = |error: Option<String>| BridgeInfo {
		code: code.clone(),
		address: lan.as_ref().map(|(_, ip)| format!("{ip}:{port}")),
		advertising: error.is_none(),
		error,
	};
	let Some((interface, ip)) = &lan else {
		tracing::warn!("Failed to advertise the bridge: no local network interface");
		return (
			info(Some("No local network to advertise on.".to_owned())),
			None,
		);
	};

	match register(port, &code, interface, *ip).await {
		Ok(advertiser) => {
			tracing::info!("Advertising the bridge on {interface} ({ip}) with pairing code {code}");
			(info(None), Some(advertiser))
		}
		Err(error) => {
			tracing::warn!("Failed to advertise the bridge on {interface}: {error}");
			(info(Some(error)), None)
		}
	}
}

impl Advertiser {
	/// Unregisters, which sends goodbyes so a phone's prompt goes away, then stops the responder.
	pub(crate) async fn stop(self) {
		if let Ok(status) = self.daemon.unregister(&self.fullname) {
			let unregistered = tokio::time::timeout(UNREGISTER_WAIT, status.recv_async()).await;

			if !matches!(unregistered, Ok(Ok(UnregisterStatus::OK))) {
				tracing::warn!(
					"Failed to unregister the bridge advertisement {}",
					self.fullname
				);
			}
		}

		let _ = self.daemon.shutdown();
	}
}

/// Registers on `ip`'s interface alone, so a phone never resolves a VPN, WSL or Docker address,
/// and waits for the first announcement to prove the network took it.
async fn register(
	port: u16,
	code: &str,
	interface: &str,
	ip: Ipv4Addr,
) -> Result<Advertiser, String> {
	let daemon = ServiceDaemon::new().map_err(|error| {
		format!("The mDNS port (UDP 5353) is unavailable ({error}). {FIREWALL_HINT}")
	})?;
	let registered = async {
		daemon.disable_interface(IfKind::All)?;
		daemon.enable_interface(IfKind::Addr(IpAddr::V4(ip)))?;

		let monitor = daemon.monitor()?;
		let computer = computer_name();
		let service = ServiceInfo::new(
			&format!("{BRIDGE_SERVICE_TYPE}.local."),
			&computer,
			// Not the computer's own host name, which the system's responder owns; claiming it with
			// other addresses would make the system rename itself.
			&format!("unbound-bridge-{}.local.", dns_label(&computer)),
			IpAddr::V4(ip),
			port,
			&[
				("proto", BRIDGE_SERVICE_PROTOCOL),
				("by", ADVERTISED_BY),
				("code", code),
			][..],
		)?;
		let fullname = service.get_fullname().to_owned();

		daemon.register(service)?;
		Ok::<_, mdns_sd::Error>((monitor, fullname))
	}
	.await;
	let announced = match registered {
		Ok((monitor, fullname)) => announced(&monitor, interface).await.map(|()| fullname),
		Err(error) => Err(format!(
			"The mDNS responder refused the advertisement: {error}"
		)),
	};

	match announced {
		Ok(fullname) => Ok(Advertiser { daemon, fullname }),
		Err(error) => {
			let _ = daemon.shutdown();
			Err(error)
		}
	}
}

/// `Ok` once the responder announced on some interface; it announces on none the network blocks.
async fn announced(
	monitor: &mdns_sd::Receiver<DaemonEvent>,
	interface: &str,
) -> Result<(), String> {
	let first = async {
		while let Ok(event) = monitor.recv_async().await {
			match event {
				DaemonEvent::Announce(..) => return Ok(()),
				DaemonEvent::Error(error) => return Err(error.to_string()),
				_ => {}
			}
		}

		Err("The mDNS responder stopped.".to_owned())
	};

	tokio::time::timeout(ANNOUNCE_WAIT, first)
		.await
		.unwrap_or_else(|_| {
			Err(format!(
				"Nothing was announced on {interface}. {FIREWALL_HINT}"
			))
		})
}

/// Four random digits, new each run, so the phone's prompt names this bridge and no other.
fn pairing_code() -> String {
	format!("{:04}", uuid::Uuid::new_v4().as_u128() % 10_000)
}

/// The computer's name as people know it, without a `.local` or domain suffix.
fn computer_name() -> String {
	let host = gethostname::gethostname().to_string_lossy().into_owned();
	let name = host.split('.').next().unwrap_or_default();

	if name.is_empty() {
		"Computer".to_owned()
	} else {
		name.to_owned()
	}
}

/// `name` as one DNS label: lowercase letters, digits and hyphens.
fn dns_label(name: &str) -> String {
	let label: String = name
		.chars()
		.map(|char| {
			if char.is_ascii_alphanumeric() {
				char.to_ascii_lowercase()
			} else {
				'-'
			}
		})
		.collect();

	label.trim_matches('-').to_owned()
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn pairing_codes_are_four_digits() {
		for _ in 0..100 {
			let code = pairing_code();

			assert!(
				code.len() == 4 && code.chars().all(|char| char.is_ascii_digit()),
				"{code}"
			);
		}
	}

	#[test]
	fn a_computer_name_becomes_one_dns_label() {
		assert_eq!(dns_label("Mario's MacBook Pro"), "mario-s-macbook-pro");
		assert_eq!(dns_label("DESKTOP-4F2K"), "desktop-4f2k");
	}
}
