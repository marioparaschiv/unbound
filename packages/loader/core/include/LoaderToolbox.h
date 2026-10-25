#pragma once

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

    constexpr const char *kIssueRepository = "marioparaschiv/unbound";

    const char *addonDirectoryName(AddonKind kind);
    std::optional<AddonKind> addonKindNamed(const std::string &name);
    bool        wipeAddons(const std::string &documents, AddonKind kind);
    bool        factoryReset(const std::string &documents);
    void        deleteBundle(SettingsStore &settings, BundleUpdater &updater, const std::string &documents);
    bool        useCustomBundle(SettingsStore &settings, const std::string &url);
    bool        toggleRecovery(SettingsStore &settings);
    std::string issueBody(const IssueReport &report);
    std::string issueURL(const IssueReport &report);
}
