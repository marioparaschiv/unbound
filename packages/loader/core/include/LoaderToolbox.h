#pragma once

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "LoaderSettings.h"
#include "LoaderUpdater.h"

namespace loader::toolbox
{
    enum class AddonKind
    {
        Plugins,
        Themes,
        Icons,
        Fonts,
    };

    struct IssueReport
    {
        std::string                                      platform;
        std::vector<std::pair<std::string, std::string>> environment;
        std::vector<std::pair<std::string, std::string>> attachments;
    };

    struct IssueFacts
    {
        std::string platform;
        std::string device;
        std::string osVersion;
        std::string discordVersion;
        std::string unboundVersion;
        std::string appSource;
        std::string registration;
        bool        virtualDevice = false;
    };

    struct ToolboxContext
    {
        SettingsStore                              &settings;
        BundleUpdater                              &updater;
        std::string                                 documents;
        std::string                                 platform;
        std::function<std::optional<std::string>()> updateURL;
        std::function<uint32_t()>                   bytecodeVersion;
    };

    constexpr const char *kIssueRepository        = "marioparaschiv/unbound";
    constexpr const char *kRefetchFailedMessage    = "The bundle could not be downloaded.";
    constexpr const char *kCustomBundleInvalidText = "Enter an http or https URL.";

    const char *addonDirectoryName(AddonKind kind);
    std::optional<AddonKind> addonKindNamed(const std::string &name);
    bool        wipeAddons(const std::string &documents, AddonKind kind);
    bool        factoryReset(const std::string &documents);
    void        deleteBundle(SettingsStore &settings, BundleUpdater &updater, const std::string &documents);
    bool        useCustomBundle(SettingsStore &settings, const std::string &url);
    bool        toggleRecovery(SettingsStore &settings);
    bool        refetchBundle(BundleUpdater &updater, const std::optional<std::string> &updateURL,
                              uint32_t bytecodeVersion);
    std::string perform(ToolboxContext &context, const std::string &action, const std::string &argument);
    std::vector<std::pair<std::string, std::string>> issueEnvironment(const IssueFacts &facts);
    std::string issueBody(const IssueReport &report);
    std::string issueURL(const IssueReport &report);
}
