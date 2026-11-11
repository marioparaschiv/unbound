#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

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
    std::optional<bool>   discordSigned;
};

struct SigningFacts {
    std::optional<std::string> teamIdentifier;
    bool                       getTaskAllow         = false;
    bool                       hasProfile           = false;
    bool                       provisionsAllDevices = false;
    bool                       listsDevices         = false;
    std::optional<std::string> profileExpiry;
    bool                       altStore = false;
    std::string                entitlementSource;
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
std::string signingDetails(const SigningFacts &facts);
std::optional<std::string> provisioningProfilePlist(const std::string &profile);
bool        isDiscordProductionTeam(const std::optional<std::string> &teamIdentifier);
bool        isVirtualDeviceMachine(const std::string &machine);
std::string osVersionLabel(const std::string &version, const std::optional<std::string> &build);

std::optional<std::string> defaultIPv4Gateway(const uint8_t *table, size_t length);

struct HookFramework {
    std::string name;
    std::string package;
};

std::optional<HookFramework> hookFrameworkForImage(const std::string &imagePath,
                                                   bool               exportsLibhookerAPI);
std::optional<std::string>   dpkgPackageVersion(const std::string &status,
                                                const std::string &package);
std::string                  frameworkLabel(const std::string &name, const std::string &version);

std::string jailbreakName(const std::string &root, const std::vector<std::string> &markers,
                          const std::vector<std::string> &images, bool roothide = false);
std::string jailbreakLabel(const std::string &name, const std::string &version);
}
