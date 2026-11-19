#include <cassert>

#include "LoaderNetworkStack.h"

using loader::environment_report::InterfaceAddress;
using loader::environment_report::networkStackMarker;

int main()
{
    InterfaceAddress loopback{"lo0", "127.0.0.1", false};
    InterfaceAddress wifi{"en0", "192.168.1.20", false};
    InterfaceAddress linkLocal{"en0", "fe80::1", true};
    InterfaceAddress global{"pdp_ip0", "2001:db8::5", true};
    InterfaceAddress clat{"v4-rmnet_data0", "192.0.0.4", false};

    assert(networkStackMarker({loopback, wifi, linkLocal, global}).empty());
    assert(networkStackMarker({loopback, linkLocal}).empty());
    assert(networkStackMarker({loopback, linkLocal, global}) == "IPv6-only network");
    assert(networkStackMarker({loopback, global, clat}) == "IPv6-only network (464XLAT)");
    return 0;
}
