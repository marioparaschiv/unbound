#include "LoaderEnvironment.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cstring>
#include <sstream>
#include <vector>

namespace loader::environment {
Receipt receiptKind(const std::optional<std::string> &receiptName, bool receiptExists)
{
    if (!receiptName)
    {
        return Receipt::None;
    }
    if (*receiptName == kSandboxReceiptName)
    {
        return Receipt::TestFlight;
    }
    return receiptExists ? Receipt::AppStore : Receipt::None;
}

bool isTrollStoreInstall(Receipt receipt, bool trollStore, bool trollStoreLite)
{
    return receipt == Receipt::None && (trollStore || trollStoreLite);
}

std::string trollStoreVariant(bool trollStore, bool trollStoreLite)
{
    if (trollStore)
    {
        return "TrollStore";
    }
    return trollStoreLite ? "TrollStore Lite" : "Unknown";
}

std::string appSource(const InstallFacts &facts)
{
    if (facts.simulator)
    {
        return "iOS Simulator";
    }
    if (isTrollStoreInstall(facts.receipt, facts.trollStore, facts.trollStoreLite))
    {
        return trollStoreVariant(facts.trollStore, facts.trollStoreLite);
    }
    if (facts.liveContainer)
    {
        const bool jit = facts.jitAvailable && facts.jitAvailable();
        return jit ? "LiveContainer (JIT)" : "LiveContainer (Signed)";
    }
    switch (facts.receipt)
    {
        case Receipt::AppStore:
            return "App Store";
        case Receipt::TestFlight:
            return "TestFlight";
        case Receipt::None:
            break;
    }
    return "Sideloaded";
}

bool isDiscordProductionTeam(const std::optional<std::string> &teamIdentifier)
{
    return teamIdentifier == kDiscordTeamIdentifier;
}

bool isVirtualDeviceMachine(const std::string &machine)
{
    return machine == kVirtualDeviceMachine;
}

std::string osVersionLabel(const std::string &version, const std::optional<std::string> &build)
{
    return build ? version + " (" + *build + ")" : version;
}

namespace {
    constexpr size_t  kRouteMessageHeaderSize = 92;
    constexpr size_t  kRouteAddressMaskOffset = 12;
    constexpr size_t  kRouteAddressCount      = 8;
    constexpr size_t  kDestinationIndex       = 0;
    constexpr size_t  kGatewayIndex           = 1;
    constexpr size_t  kSocketAddressAlignment = sizeof(uint32_t);
    constexpr size_t  kIPv4AddressSize        = 16;
    constexpr size_t  kIPv4AddressOffset      = 4;
    constexpr uint8_t kIPv4Family             = 2;

    template <typename T> T readValue(const uint8_t *bytes)
    {
        T value;
        std::memcpy(&value, bytes, sizeof(T));
        return value;
    }

    size_t socketAddressLength(uint8_t declared)
    {
        return declared > 0 ? 1 + ((declared - 1) | (kSocketAddressAlignment - 1))
                            : kSocketAddressAlignment;
    }

    bool isIPv4Address(const uint8_t *address)
    {
        return address && address[1] == kIPv4Family && address[0] >= kIPv4AddressSize;
    }

    std::string dottedQuad(const uint8_t *address)
    {
        const uint8_t *octets = address + kIPv4AddressOffset;
        return std::to_string(octets[0]) + "." + std::to_string(octets[1]) + "." +
               std::to_string(octets[2]) + "." + std::to_string(octets[3]);
    }

    std::optional<std::string> defaultRouteGateway(const uint8_t *message, const uint8_t *end)
    {
        std::array<const uint8_t *, kRouteAddressCount> addresses{};
        const int      mask   = readValue<int>(message + kRouteAddressMaskOffset);
        const uint8_t *cursor = message + kRouteMessageHeaderSize;

        for (size_t index = 0; index < kRouteAddressCount; index++)
        {
            if (!(mask & (1 << index)))
            {
                continue;
            }
            if (cursor >= end)
            {
                return std::nullopt;
            }
            const size_t length = socketAddressLength(cursor[0]);
            if (length > static_cast<size_t>(end - cursor))
            {
                return std::nullopt;
            }
            addresses[index] = cursor;
            cursor += length;
        }

        const uint8_t *destination = addresses[kDestinationIndex];
        const uint8_t *gateway     = addresses[kGatewayIndex];
        if (!isIPv4Address(destination) || !isIPv4Address(gateway) ||
            readValue<uint32_t>(destination + kIPv4AddressOffset) != 0)
        {
            return std::nullopt;
        }
        return dottedQuad(gateway);
    }
}

std::optional<std::string> defaultIPv4Gateway(const uint8_t *table, size_t length)
{
    if (!table)
    {
        return std::nullopt;
    }
    const uint8_t *cursor = table;
    const uint8_t *end    = table + length;
    while (static_cast<size_t>(end - cursor) >= kRouteMessageHeaderSize)
    {
        const uint16_t messageLength = readValue<uint16_t>(cursor);
        if (messageLength < kRouteMessageHeaderSize ||
            messageLength > static_cast<size_t>(end - cursor))
        {
            break;
        }
        const uint8_t *next = cursor + messageLength;
        if (auto gateway = defaultRouteGateway(cursor, next))
        {
            return gateway;
        }
        cursor = next;
    }
    return std::nullopt;
}

std::optional<HookFramework> hookFrameworkForImage(const std::string &imagePath,
                                                   bool               exportsLibhookerAPI)
{
    static const std::vector<std::pair<std::string, HookFramework>> markers = {
        {"ellekit", {"ElleKit", "ellekit"}},
        {"libhooker", {"libhooker", "org.coolstar.libhooker"}},
        {"substitute", {"Substitute", "com.ex.substitute"}},
        {"substrate", {"Substrate", "mobilesubstrate"}},
    };
    std::string lowered = imagePath;
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char character) {
        return std::tolower(character);
    });
    for (const auto &[marker, framework] : markers)
    {
        if (lowered.find(marker) != std::string::npos)
        {
            bool elleKitShim = framework.name == "Substrate" && exportsLibhookerAPI;
            return elleKitShim ? markers.front().second : framework;
        }
    }
    return std::nullopt;
}

std::optional<std::string> dpkgPackageVersion(const std::string &status, const std::string &package)
{
    std::istringstream lines(status);
    std::string        line;
    bool               inPackage = false;
    while (std::getline(lines, line))
    {
        if (!line.empty() && line.back() == '\r')
        {
            line.pop_back();
        }
        if (line.empty())
        {
            inPackage = false;
        }
        else if (line.rfind("Package: ", 0) == 0)
        {
            inPackage = line.substr(9) == package;
        }
        else if (inPackage && line.rfind("Version: ", 0) == 0)
        {
            return line.substr(9);
        }
    }
    return std::nullopt;
}

std::string frameworkLabel(const std::string &name, const std::string &version)
{
    if (name.empty() || version.empty())
    {
        return name;
    }
    return name + " " + version;
}
}
