#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <optional>
#include <string>

namespace loader::environment {
enum class Receipt
{
    None,
    AppStore,
    TestFlight,
};

struct InstallFacts {
    bool                  simulator      = false;
    Receipt               receipt        = Receipt::None;
    bool                  trollStore     = false;
    bool                  trollStoreLite = false;
    bool                  liveContainer  = false;
    std::function<bool()> jitAvailable;
};

constexpr const char *kSandboxReceiptName    = "sandboxReceipt";
constexpr const char *kTrollStoreMarker      = "../_TrollStore";
constexpr const char *kTrollStoreLiteMarker  = "../_TrollStoreLite";
constexpr const char *kDiscordTeamIdentifier = "53Q6R32WPB";
constexpr const char *kVirtualDeviceMachine  = "iPhone99,11";

Receipt     receiptKind(const std::optional<std::string> &receiptName, bool receiptExists);
bool        isTrollStoreInstall(Receipt receipt, bool trollStore, bool trollStoreLite);
std::string trollStoreVariant(bool trollStore, bool trollStoreLite);
std::string appSource(const InstallFacts &facts);
bool        isDiscordProductionTeam(const std::optional<std::string> &teamIdentifier);
bool        isVirtualDeviceMachine(const std::string &machine);
std::string osVersionLabel(const std::string &version, const std::optional<std::string> &build);

std::optional<std::string> defaultIPv4Gateway(const uint8_t *table, size_t length);
}
