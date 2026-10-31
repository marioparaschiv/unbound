#include <cassert>
#include <cstring>
#include <string>
#include <vector>

#include "LoaderEnvironment.h"

using namespace loader::environment;

static void checkInstallSources()
{
    assert(receiptKind(std::nullopt, true) == Receipt::None);
    assert(receiptKind("sandboxReceipt", false) == Receipt::TestFlight);
    assert(receiptKind("receipt", true) == Receipt::AppStore);
    assert(receiptKind("receipt", false) == Receipt::None);

    assert(isTrollStoreInstall(Receipt::None, true, false));
    assert(isTrollStoreInstall(Receipt::None, false, true));
    assert(!isTrollStoreInstall(Receipt::None, false, false));
    assert(!isTrollStoreInstall(Receipt::AppStore, true, true));
    assert(!isTrollStoreInstall(Receipt::TestFlight, true, false));

    assert(trollStoreVariant(true, true) == "TrollStore");
    assert(trollStoreVariant(false, true) == "TrollStore Lite");
    assert(trollStoreVariant(false, false) == "Unknown");

    int  jitQueries = 0;
    auto jit        = [&jitQueries](bool available) {
        return [&jitQueries, available] {
            jitQueries++;
            return available;
        };
    };

    assert(appSource({true, Receipt::AppStore, true, false, true, jit(true)}) == "iOS Simulator");
    assert(appSource({false, Receipt::None, false, true, true, jit(true)}) == "TrollStore Lite");
    assert(appSource({false, Receipt::AppStore, true, false, false, {}}) == "App Store");
    assert(jitQueries == 0);
    assert(appSource({false, Receipt::AppStore, false, false, true, jit(true)}) ==
           "LiveContainer (JIT)");
    assert(appSource({false, Receipt::None, false, false, true, jit(false)}) ==
           "LiveContainer (Signed)");
    assert(jitQueries == 2);
    assert(appSource({false, Receipt::None, false, false, true, {}}) == "LiveContainer (Signed)");
    assert(appSource({false, Receipt::TestFlight, false, false, false, {}}) == "TestFlight");
    assert(appSource({false, Receipt::None, false, false, false, {}}) == "Sideloaded");
    assert(appSource({}) == "Sideloaded");

    assert(isDiscordProductionTeam("53Q6R32WPB"));
    assert(!isDiscordProductionTeam("ABCDE12345"));
    assert(!isDiscordProductionTeam(std::nullopt));
    assert(isVirtualDeviceMachine("iPhone99,11"));
    assert(!isVirtualDeviceMachine("iPhone12,8"));

    assert(osVersionLabel("18.6", "22G86") == "18.6 (22G86)");
    assert(osVersionLabel("18.6", std::nullopt) == "18.6");
}

static void appendSocketAddress(std::vector<uint8_t> &message, uint8_t length, uint8_t family,
                                std::vector<uint8_t> octets)
{
    std::vector<uint8_t> address(length == 0 ? 4 : length, 0);
    if (length > 0)
    {
        address[0] = length;
        address[1] = family;
    }
    for (size_t index = 0; index < octets.size() && 4 + index < address.size(); index++)
    {
        address[4 + index] = octets[index];
    }
    while (address.size() % 4)
    {
        address.push_back(0);
    }
    message.insert(message.end(), address.begin(), address.end());
}

static std::vector<uint8_t> routeMessage(int                                      addresses,
                                         const std::vector<std::vector<uint8_t>> &sockets)
{
    std::vector<uint8_t> message(92, 0);
    std::memcpy(message.data() + 12, &addresses, sizeof(addresses));
    for (const auto &socket : sockets)
    {
        message.insert(message.end(), socket.begin(), socket.end());
    }
    const uint16_t length = static_cast<uint16_t>(message.size());
    std::memcpy(message.data(), &length, sizeof(length));
    return message;
}

static std::vector<uint8_t> ipv4(std::vector<uint8_t> octets, uint8_t length = 16)
{
    std::vector<uint8_t> socket;
    appendSocketAddress(socket, length, 2, std::move(octets));
    return socket;
}

static std::optional<std::string> gateway(const std::vector<uint8_t> &table)
{
    return defaultIPv4Gateway(table.data(), table.size());
}

static void checkRoutingTable()
{
    const std::vector<uint8_t> defaultRoute =
        routeMessage(0x7, {ipv4({0, 0, 0, 0}), ipv4({192, 168, 64, 1}), ipv4({0, 0, 0, 0})});
    assert(gateway(defaultRoute) == "192.168.64.1");

    const std::vector<uint8_t> hostRoute =
        routeMessage(0x3, {ipv4({10, 0, 0, 5}), ipv4({10, 0, 0, 1})});
    std::vector<uint8_t> table = hostRoute;
    assert(!gateway(table));
    table.insert(table.end(), defaultRoute.begin(), defaultRoute.end());
    assert(gateway(table) == "192.168.64.1");

    std::vector<uint8_t> ipv6Gateway(16, 0);
    ipv6Gateway[0] = 16;
    ipv6Gateway[1] = 30;
    assert(!gateway(routeMessage(0x3, {ipv4({0, 0, 0, 0}), ipv6Gateway})));
    assert(!gateway(routeMessage(0x1, {ipv4({0, 0, 0, 0})})));
    assert(!gateway(routeMessage(0x3, {ipv4({0, 0, 0, 0}), ipv4({172, 16, 0, 1}, 8)})));

    std::vector<uint8_t> skipped(4, 0);
    assert(gateway(routeMessage(0x7, {ipv4({0, 0, 0, 0}), ipv4({10, 1, 2, 3}), skipped})) ==
           "10.1.2.3");

    std::vector<uint8_t> truncated = defaultRoute;
    truncated.resize(truncated.size() - 8);
    assert(!gateway(truncated));

    std::vector<uint8_t> shortHeader = defaultRoute;
    const uint16_t       tooShort    = 40;
    std::memcpy(shortHeader.data(), &tooShort, sizeof(tooShort));
    assert(!gateway(shortHeader));

    std::vector<uint8_t> overrun = routeMessage(0x3, {ipv4({0, 0, 0, 0})});
    const uint16_t       claimed = static_cast<uint16_t>(overrun.size());
    overrun.resize(overrun.size() - 4);
    std::memcpy(overrun.data(), &claimed, sizeof(claimed));
    assert(!gateway(overrun));

    assert(!defaultIPv4Gateway(nullptr, 100));
    assert(!gateway({}));
}

static void checkHookFrameworks()
{
    assert(hookFrameworkForImage("/var/jb/usr/lib/libellekit.dylib", true)->name == "ElleKit");
    assert(
        hookFrameworkForImage("/Library/Frameworks/CydiaSubstrate.framework/CydiaSubstrate", false)
            ->name == "Substrate");
    assert(hookFrameworkForImage("/usr/lib/libsubstitute.dylib", false)->package ==
           "com.ex.substitute");
    assert(hookFrameworkForImage("/var/jb/usr/lib/libhooker.dylib", true)->name == "libhooker");
    assert(!hookFrameworkForImage("/usr/lib/libobjc.A.dylib", false));
    assert(hookFrameworkForImage(
               "/x/Discord.app/Frameworks/CydiaSubstrate.framework/CydiaSubstrate", true)
               ->name == "ElleKit");

    std::string status = "Package: mobilesubstrate\nVersion: 0.9.7\n\nPackage: ellekit\r\n"
                         "Status: install ok installed\r\nVersion: 1.1.3\r\n";
    assert(dpkgPackageVersion(status, "ellekit") == "1.1.3");
    assert(dpkgPackageVersion(status, "mobilesubstrate") == "0.9.7");
    assert(!dpkgPackageVersion(status, "com.ex.substitute"));

    assert(frameworkLabel("Vector", "2.0") == "Vector 2.0");
    assert(frameworkLabel("ElleKit", "") == "ElleKit");
    assert(frameworkLabel("", "1.0").empty());
}

int main()
{
    checkHookFrameworks();
    checkInstallSources();
    checkRoutingTable();
    return 0;
}
