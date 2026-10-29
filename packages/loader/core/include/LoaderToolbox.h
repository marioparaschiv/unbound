#pragma once

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "LoaderPreferences.h"
#include "LoaderSettings.h"
#include "LoaderUpdater.h"
#include "NativePlatformBridge.h"

namespace loader::toolbox {
enum class AddonKind
{
    Plugins,
    Themes,
    Icons,
    Fonts,
};

enum class MenuItemKind
{
    Action,
    Toggle,
    Platform,
};

struct MenuPrompt {
    std::string title;
    std::string message;
    std::string placeholder;
    std::string confirm;
    std::string cancel;
};

struct MenuItem {
    std::string                                id;
    std::string                                title;
    MenuItemKind                               kind = MenuItemKind::Action;
    std::string                                action;
    std::string                                argument;
    bool                                       destructive = false;
    bool                                       restartsApp = false;
    std::string                                progress;
    std::string                                failure;
    std::optional<MenuPrompt>                  prompt;
    std::optional<preferences::ToolboxGesture> gesture;
    bool                                       on = false;
};

struct MenuSection {
    std::string           title;
    std::vector<MenuItem> items;
};

struct MenuOptions {
    bool openAppFolder     = false;
    bool copyAppFolderPath = false;
    bool unboundIcon       = false;
};

struct IssueReport {
    std::string                                      platform;
    std::vector<std::pair<std::string, std::string>> environment;
    std::vector<std::pair<std::string, std::string>> attachments;
};

struct IssueFacts {
    std::string platform;
    std::string device;
    std::string osVersion;
    std::string discordVersion;
    std::string unboundVersion;
    std::string appSource;
    std::string registration;
    bool        virtualDevice = false;
    std::string framework;
    bool        rooted = false;
};

struct ToolboxContext {
    SettingsStore                              &settings;
    BundleUpdater                              &updater;
    std::string                                 documents;
    std::string                                 platform;
    std::function<std::optional<std::string>()> updateURL;
    std::function<uint32_t()>                   bytecodeVersion;
    std::function<bool()>                       bundleReady;
};

enum class MenuStep
{
    None,
    Confirm,
    Platform,
    Prompt,
    Run,
};

enum class MenuOutcome
{
    Done,
    Failed,
    Restart,
};

struct RecoveryToggle {
    bool        enabled = false;
    std::string status;
    bool        restartRequired = false;
};

constexpr const char *kIssueRepository        = "marioparaschiv/unbound";
constexpr const char *kRecoveryShortcutAction = "app.unbound.recovery.toggle";
constexpr const char *kToolboxTitle           = "Unbound Toolbox";
constexpr const char *kCloseText              = "Close";
constexpr const char *kConfirmText            = "Confirm";
constexpr const char *kCancelText             = "Cancel";
constexpr const char *kDestructiveConfirmation =
    "This cannot be undone. Discord restarts afterwards.";
constexpr const char *kRefetchProgressMessage      = "Refetching the bundle…";
constexpr const char *kRefetchFailedMessage        = "The bundle could not be downloaded.";
constexpr const char *kCustomBundleInvalidText     = "Enter an http or https URL.";
constexpr const char *kIssueFailedMessage          = "The GitHub issue page could not be opened.";
constexpr unsigned    kThreeFingerHoldMilliseconds = 500;
constexpr double      kShakeMinimumSeconds         = 0.5;
constexpr double      kShakeMaximumSeconds         = 2.0;

const char              *addonDirectoryName(AddonKind kind);
const char              *addonTitle(AddonKind kind);
std::optional<AddonKind> addonKindNamed(const std::string &name);
bool                     wipeAddons(const std::string &documents, AddonKind kind);
bool                     factoryReset(const std::string &documents);
void deleteBundle(SettingsStore &settings, BundleUpdater &updater, const std::string &documents);
bool useCustomBundle(SettingsStore &settings, const std::string &url);
bool toggleRecovery(SettingsStore &settings);
RecoveryToggle                toggleRecoveryFromShortcut(SettingsStore &settings, bool bundleReady);
std::vector<size_t>           shortcutsAfterRecovery(const std::vector<std::string> &types);
std::optional<RecoveryToggle> activateShortcut(SettingsStore &settings, bool bundleReady,
                                               const std::string &type);
bool refetchBundle(BundleUpdater &updater, const std::optional<std::string> &updateURL,
                   uint32_t bytecodeVersion);
std::vector<MenuSection> menu(const SettingsStore &settings, const MenuOptions &options);
MenuOptions              menuOptions(const std::string &json);
nlohmann::json           menuJSON(const SettingsStore &settings, const MenuOptions &options);
std::string              perform(ToolboxContext &context, const std::string &action,
                                 const std::string &argument);
IssueFacts  issueFacts(const NativePlatformProvider &provider, const std::string &platform,
                       const std::string &discordVersion);
IssueReport issueReport(const NativePlatformProvider &provider, const std::string &platform,
                        const std::string &discordVersion);
std::vector<std::pair<std::string, std::string>> issueEnvironment(const IssueFacts &facts);
std::string discordLine(const std::string &label, const std::string &appSource);
std::string issueBody(const IssueReport &report);
std::string issueURL(const IssueReport &report);

MenuStep                 menuStep(const nlohmann::json &item, bool confirmed);
MenuOutcome              menuOutcome(const nlohmann::json &item, const std::string &result);
const char              *menuStepName(MenuStep step);
const char              *menuOutcomeName(MenuOutcome outcome);
std::string              menuStepFor(const std::string &request);
std::string              menuOutcomeFor(const std::string &request);
bool                     isShakeGesture(double seconds);
std::string              discordVersionLabel(const std::optional<std::string> &version,
                                             const std::string                &build);
std::vector<std::string> appFolderURLs(const std::string &documents, bool jailbroken);
}
