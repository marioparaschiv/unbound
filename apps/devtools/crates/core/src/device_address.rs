//! The addresses to type into Unbound's Debugger Address setting so Discord reaches this app's
//! bridge: one per way a device might see this machine.

use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};

use crate::presets::BridgeAddr;
use crate::session::Devtools;

/// The emulator's alias for the host's loopback.
const EMULATOR_HOST: Ipv4Addr = Ipv4Addr::new(10, 0, 2, 2);

/// One way to reach the bridge, and what kind of network it goes over.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeviceAddress {
	pub label: String,
	pub address: String,
}

impl Devtools {
	/// Every address a device could dial for the linked bridge (else the default one), the most
	/// likely first: the one the default route leaves from.
	pub fn device_addresses(&self) -> Vec<DeviceAddress> {
		let bridge = self
			.link_target()
			.map_or_else(|| self.default_target().bridge, |target| target.bridge);
		let interfaces = if_addrs::get_if_addrs()
			.map(|interfaces| {
				interfaces
					.into_iter()
					.map(|interface| (interface.name.clone(), interface.ip()))
					.collect()
			})
			.unwrap_or_default();
		device_addresses(&bridge, route_address(), interfaces)
	}

	/// The first of [`Devtools::device_addresses`].
	pub fn device_address(&self) -> String {
		self.device_addresses()
			.into_iter()
			.next()
			.map(|choice| choice.address)
			.unwrap_or_default()
	}
}

/// A bridge on another machine is dialled as it is. A bridge on this machine is dialled at each of
/// its IPv4 addresses, the route's first, then from the Android emulator, then only from here.
pub fn device_addresses(
	bridge: &BridgeAddr,
	route: Option<IpAddr>,
	interfaces: Vec<(String, IpAddr)>,
) -> Vec<DeviceAddress> {
	let host = bridge.host();
	let local = host == "localhost" || host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback());
	if !local {
		return vec![DeviceAddress {
			label: "Bridge".to_owned(),
			address: bridge.to_string(),
		}];
	}
	let at = |ip: IpAddr| BridgeAddr::from(SocketAddr::new(ip, bridge.port())).to_string();
	let mut found: Vec<(String, IpAddr)> = interfaces
		.into_iter()
		.filter(|(name, ip)| ip.is_ipv4() && !ip.is_loopback() && !is_virtual(name))
		.collect();
	// The route's interface leads; the rest keep the system's order.
	found.sort_by_key(|(_, ip)| Some(*ip) != route);
	found
		.into_iter()
		.map(|(name, ip)| DeviceAddress {
			label: network_label(&name, ip),
			address: at(ip),
		})
		.chain([
			DeviceAddress {
				label: "Android Emulator".to_owned(),
				address: at(IpAddr::V4(EMULATOR_HOST)),
			},
			DeviceAddress {
				label: "This Machine Only".to_owned(),
				address: at(IpAddr::V4(Ipv4Addr::LOCALHOST)),
			},
		])
		.collect()
}

/// Container and VM bridges only reach guests on this machine, never a phone.
fn is_virtual(interface: &str) -> bool {
	const PREFIXES: [&str; 7] = [
		"docker", "br-", "veth", "virbr", "vmnet", "vboxnet", "podman",
	];
	PREFIXES.iter().any(|prefix| interface.starts_with(prefix))
}

/// Names the network an address is on, with its interface: `Tailscale`, `Local Network (en0)`.
fn network_label(interface: &str, ip: IpAddr) -> String {
	let IpAddr::V4(v4) = ip else {
		return interface.to_owned();
	};
	let [first, second, ..] = v4.octets();
	if first == 100 && (64..128).contains(&second) {
		"Tailscale".to_owned()
	} else if v4.is_private() || v4.is_link_local() {
		format!("Local Network ({interface})")
	} else {
		format!("Public ({interface})")
	}
}

/// The address the default route leaves from. Connecting a UDP socket sends nothing; it only picks
/// the interface.
fn route_address() -> Option<IpAddr> {
	let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
	socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).ok()?;
	let ip = socket.local_addr().ok()?.ip();
	(!ip.is_loopback() && !ip.is_unspecified()).then_some(ip)
}

#[cfg(test)]
mod tests {
	use std::net::{IpAddr, Ipv4Addr};

	use super::device_addresses;
	use crate::presets::BridgeAddr;

	fn ip(a: u8, b: u8, c: u8, d: u8) -> IpAddr {
		IpAddr::V4(Ipv4Addr::new(a, b, c, d))
	}

	fn bridge(text: &str) -> BridgeAddr {
		text.parse().expect("a bridge address")
	}

	#[test]
	fn a_local_bridge_lists_the_route_first_then_the_fallbacks() {
		let interfaces = vec![
			("tailscale0".to_owned(), ip(100, 64, 0, 2)),
			("lo".to_owned(), ip(127, 0, 0, 1)),
			("docker0".to_owned(), ip(172, 17, 0, 1)),
			("en0".to_owned(), ip(192, 168, 1, 20)),
		];
		let listed = device_addresses(
			&bridge("127.0.0.1:9090"),
			Some(ip(192, 168, 1, 20)),
			interfaces,
		);
		let pairs: Vec<(&str, &str)> = listed
			.iter()
			.map(|choice| (choice.label.as_str(), choice.address.as_str()))
			.collect();
		assert_eq!(
			pairs,
			[
				("Local Network (en0)", "192.168.1.20:9090"),
				("Tailscale", "100.64.0.2:9090"),
				("Android Emulator", "10.0.2.2:9090"),
				("This Machine Only", "127.0.0.1:9090"),
			]
		);
	}

	#[test]
	fn a_remote_bridge_is_dialled_as_it_is() {
		let listed = device_addresses(&bridge("100.64.0.9:9090"), None, Vec::new());
		assert_eq!(listed.len(), 1);
		assert_eq!(listed[0].address, "100.64.0.9:9090");
	}
}
