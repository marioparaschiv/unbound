#include "LoaderToolbox.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <system_error>

#include "LoaderDevOverlay.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"
#include "LoaderVersion.h"

namespace loader::toolbox {
static std::string lowercase(std::string value)
{
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
        return std::tolower(character);
    });
    return value;
}

static std::string percentEncode(const std::string &value)
{
    static const char *const kHex = "0123456789ABCDEF";
    std::string              encoded;

    for (unsigned char character : value)
    {
        if (std::isalnum(character) || character == '-' || character == '_' || character == '.' ||
            character == '~')
        {
            encoded.push_back(static_cast<char>(character));
            continue;
        }

        encoded.push_back('%');
        encoded.push_back(kHex[character >> 4]);
        encoded.push_back(kHex[character & 0x0F]);
    }

    return encoded;
}

const char *addonDirectoryName(AddonKind kind)
{
    switch (kind)
    {
        case AddonKind::Plugins:
            return "Plugins";
        case AddonKind::Themes:
            return "Themes";
        case AddonKind::Icons:
            return "Icons";
        case AddonKind::Fonts:
            return "Fonts";
    }
    return "";
}

const char *addonTitle(AddonKind kind)
{
    return kind == AddonKind::Icons ? "Icon Packs" : addonDirectoryName(kind);
}

std::optional<AddonKind> addonKindNamed(const std::string &name)
{
    for (auto kind : {AddonKind::Plugins, AddonKind::Themes, AddonKind::Icons, AddonKind::Fonts})
    {
        if (lowercase(name) == lowercase(addonDirectoryName(kind)))
        {
            return kind;
        }
    }
    return std::nullopt;
}

bool wipeAddons(const std::string &documents, AddonKind kind)
{
    const std::string wanted = lowercase(addonDirectoryName(kind));
    std::error_code   error;
    bool              removed = false;

    for (const std::string &name : listDirectory(documents))
    {
        if (lowercase(name) != wanted)
        {
            continue;
        }

        std::filesystem::remove_all(std::filesystem::path(documents) / name, error);
        removed = removed || !error;
    }

    return removed;
}

bool factoryReset(const std::string &documents)
{
    std::error_code error;
    bool            succeeded = true;

    for (const std::string &name : listDirectory(documents))
    {
        std::filesystem::remove_all(std::filesystem::path(documents) / name, error);
        succeeded = succeeded && !error;
    }

    return succeeded;
}

void deleteBundle(SettingsStore &settings, BundleUpdater &updater, const std::string &documents)
{
    settings.set("unbound", "loader.update.url", nullptr);
    settings.set("unbound", "loader.update.force", nullptr);
    settings.save();

    for (const char *extension : {"bundle", "js"})
    {
        const std::string path = joinPath(documents, std::string("unbound.") + extension);

        removeFile(path);
        removeFile(path + kBundleTrustSuffix);
        updater.rejectBundle(path + ".candidate");
    }
}

static std::string trimmed(const std::string &value)
{
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos)
    {
        return "";
    }
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

bool useCustomBundle(SettingsStore &settings, const std::string &input)
{
    const std::string url    = trimmed(input);
    const std::string scheme = lowercase(url.substr(0, url.find("://")));

    if ((scheme != "https" && scheme != "http") || url.find("://") == std::string::npos ||
        url.size() <= scheme.size() + 3)
    {
        return false;
    }

    settings.set("unbound", "loader.update.url", url);
    settings.set("unbound", "loader.update.force", true);
    return settings.save();
}

bool toggleRecovery(SettingsStore &settings)
{
    const bool enabled = !preferences::recoveryEnabled(settings);

    preferences::setRecoveryEnabled(settings, enabled);
    return enabled;
}

RecoveryToggle toggleRecoveryFromShortcut(SettingsStore &settings, bool bundleReady)
{
    const bool     enabled = toggleRecovery(settings);
    RecoveryToggle result{enabled, preferences::recoveryStatusText(enabled), bundleReady};

    log(LogLevel::Info, LOG_CATEGORY_DEFAULT, "Recovery shortcut: " + result.status + ".");
    return result;
}

std::vector<size_t> shortcutsAfterRecovery(const std::vector<std::string> &types)
{
    std::vector<size_t> kept;
    for (size_t index = 0; index < types.size(); index++)
    {
        if (types[index] != kRecoveryShortcutAction)
        {
            kept.push_back(index);
        }
    }
    return kept;
}

std::optional<RecoveryToggle> activateShortcut(SettingsStore &settings, bool bundleReady,
                                               const std::string &type)
{
    if (type != kRecoveryShortcutAction)
    {
        return std::nullopt;
    }
    return toggleRecoveryFromShortcut(settings, bundleReady);
}

bool refetchBundle(BundleUpdater &updater, const std::optional<std::string> &updateURL,
                   uint32_t bytecodeVersion)
{
    try
    {
        return fileExists(
            updater.downloadBundle(updater.resolveBundlePath(), updateURL, bytecodeVersion));
    }
    catch (const std::exception &error)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            std::string("Refetching the bundle failed: ") + error.what());
        return false;
    }
}

static std::string flag(bool value)
{
    return value ? "true" : "false";
}

std::vector<std::pair<std::string, std::string>> issueEnvironment(const IssueFacts &facts)
{
    const auto known = [](const std::string &value) {
        return value.empty() ? std::string("unknown") : value;
    };
    std::vector<std::pair<std::string, std::string>> rows = {
        {"Device", known(facts.device)},
        {facts.platform + " Version", known(facts.osVersion)},
        {"Discord Version", known(facts.discordVersion)},
        {"Unbound Version", known(facts.unboundVersion)},
    };

    if (!facts.appSource.empty())
    {
        rows.emplace_back("App Source", facts.appSource);
    }
    if (!facts.framework.empty())
    {
        rows.emplace_back("Framework", facts.framework);
    }
    if (!facts.registration.empty())
    {
        rows.emplace_back("App Registration", facts.registration);
    }
    rows.emplace_back("Virtual Device", facts.virtualDevice ? "Yes" : "No");
    return rows;
}

static MenuItem restartingAction(std::string id, std::string title, std::string action,
                                 bool destructive, std::string argument = "")
{
    MenuItem item;
    item.id          = std::move(id);
    item.title       = std::move(title);
    item.action      = std::move(action);
    item.argument    = std::move(argument);
    item.destructive = destructive;
    item.restartsApp = true;
    return item;
}

static MenuItem platformItem(std::string id, std::string title,
                             MenuItemKind kind = MenuItemKind::Platform)
{
    MenuItem item;
    item.id    = std::move(id);
    item.title = std::move(title);
    item.kind  = kind;
    return item;
}

static MenuItem gestureToggle(const SettingsStore &settings, preferences::ToolboxGesture gesture,
                              std::string title)
{
    MenuItem item = platformItem(std::string("gesture-") + preferences::gestureName(gesture),
                                 std::move(title), MenuItemKind::Toggle);
    item.gesture  = gesture;
    item.on       = preferences::gestureEnabled(settings, gesture);
    return item;
}

static MenuSection bundleSection()
{
    MenuItem refetch =
        restartingAction("refetch-bundle", "Refetch Bundle", "refetch-bundle", false);
    refetch.progress = kRefetchProgressMessage;
    refetch.failure  = kRefetchFailedMessage;

    MenuItem custom =
        restartingAction("custom-bundle", "Load Custom Bundle", "custom-bundle", false);
    custom.failure = kCustomBundleInvalidText;
    custom.prompt =
        MenuPrompt{"Custom Bundle URL", "Enter the URL to download a custom bundle from",
                   "https://example.com/unbound.bundle", "Download", kCancelText};

    return {"Bundle",
            {std::move(refetch),
             restartingAction("delete-bundle", "Delete Bundle", "delete-bundle", true),
             std::move(custom)}};
}

static MenuSection addonsSection()
{
    MenuSection section{"Addons", {}};
    for (auto kind : {AddonKind::Plugins, AddonKind::Themes, AddonKind::Fonts, AddonKind::Icons})
    {
        section.items.push_back(restartingAction(
            std::string("wipe-") + lowercase(addonDirectoryName(kind)),
            std::string("Wipe ") + addonTitle(kind), "wipe", true, addonDirectoryName(kind)));
    }
    return section;
}

static MenuSection utilitiesSection(const SettingsStore &settings, const MenuOptions &options)
{
    MenuSection section{"Utilities", {}};
    section.items.push_back(restartingAction(
        "toggle-recovery", preferences::recoveryActionLabel(preferences::recoveryEnabled(settings)),
        "toggle-recovery", false));
    section.items.push_back(
        restartingAction("factory-reset", "Factory Reset", "factory-reset", true));
    if (options.openAppFolder)
    {
        section.items.push_back(platformItem("open-app-folder", "Open App Folder"));
    }
    if (options.copyAppFolderPath)
    {
        section.items.push_back(platformItem("copy-app-folder-path", "Copy App Folder Path"));
    }

    MenuItem issue = platformItem("open-issue", "Open GitHub Issue");
    issue.failure  = kIssueFailedMessage;
    section.items.push_back(std::move(issue));
    return section;
}

static MenuSection settingsSection(const SettingsStore &settings, const MenuOptions &options)
{
    MenuSection section{
        "Settings",
        {gestureToggle(settings, preferences::ToolboxGesture::Shake, "Enable Shake Motion"),
         gestureToggle(settings, preferences::ToolboxGesture::ThreeFinger,
                       "Enable Three Finger Press")}};
    if (options.unboundIcon)
    {
        section.items.push_back(
            platformItem("unbound-icon", "Use Unbound Icon", MenuItemKind::Toggle));
    }
    return section;
}

std::vector<MenuSection> menu(const SettingsStore &settings, const MenuOptions &options)
{
    return {bundleSection(), addonsSection(), utilitiesSection(settings, options),
            settingsSection(settings, options)};
}

static bool menuOption(const nlohmann::json &input, const char *key)
{
    const auto value = input.find(key);
    if (value == input.end())
    {
        return false;
    }
    if (value->is_boolean())
    {
        return value->get<bool>();
    }
    return value->is_number() && value->get<double>() != 0;
}

MenuOptions menuOptions(const std::string &json)
{
    const nlohmann::json input = nlohmann::json::parse(json, nullptr, false);
    if (!input.is_object())
    {
        return {};
    }
    return {menuOption(input, "openAppFolder"), menuOption(input, "copyAppFolderPath"),
            menuOption(input, "unboundIcon")};
}

static const char *kindName(MenuItemKind kind)
{
    switch (kind)
    {
        case MenuItemKind::Action:
            return "action";
        case MenuItemKind::Toggle:
            return "toggle";
        case MenuItemKind::Platform:
            return "platform";
    }
    return "";
}

static nlohmann::json itemJSON(const MenuItem &item)
{
    nlohmann::json json{{"id", item.id},
                        {"title", item.title},
                        {"kind", kindName(item.kind)},
                        {"destructive", item.destructive},
                        {"restartsApp", item.restartsApp}};

    const std::pair<const char *, const std::string *> optionalTexts[] = {
        {"action", &item.action},
        {"argument", &item.argument},
        {"progress", &item.progress},
        {"failure", &item.failure}};
    for (const auto &[key, value] : optionalTexts)
    {
        if (!value->empty())
        {
            json[key] = *value;
        }
    }
    if (item.prompt)
    {
        json["prompt"] = {{"title", item.prompt->title},
                          {"message", item.prompt->message},
                          {"placeholder", item.prompt->placeholder},
                          {"confirm", item.prompt->confirm},
                          {"cancel", item.prompt->cancel}};
    }
    if (item.gesture)
    {
        json["gesture"] = preferences::gestureName(*item.gesture);
        json["on"]      = item.on;
    }
    return json;
}

nlohmann::json menuJSON(const SettingsStore &settings, const MenuOptions &options)
{
    nlohmann::json sections = nlohmann::json::array();
    for (const MenuSection &section : menu(settings, options))
    {
        nlohmann::json items = nlohmann::json::array();
        for (const MenuItem &item : section.items)
        {
            items.push_back(itemJSON(item));
        }
        sections.push_back({{"title", section.title}, {"items", std::move(items)}});
    }

    return {{"title", kToolboxTitle},
            {"close", kCloseText},
            {"confirmation",
             {{"message", kDestructiveConfirmation},
              {"confirm", kConfirmText},
              {"cancel", kCancelText}}},
            {"sections", std::move(sections)}};
}

static std::string provided(const std::function<std::string()> &value)
{
    return value ? value() : std::string();
}

IssueFacts issueFacts(const NativePlatformProvider &provider, const std::string &platform,
                      const std::string &discordVersion)
{
    IssueFacts facts{platform,
                     provided(provider.deviceModel),
                     provided(provider.osVersion),
                     discordVersion,
                     loaderVersion(),
                     provided(provider.appSource),
                     "",
                     provider.isVirtualDevice && provider.isVirtualDevice(),
                     provided(provider.framework)};
    if (provider.isSystemApp)
    {
        facts.registration = provider.isSystemApp() ? "System" : "User";
    }
    return facts;
}

IssueReport issueReport(const NativePlatformProvider &provider, const std::string &platform,
                        const std::string &discordVersion)
{
    IssueReport report{
        platform, issueEnvironment(issueFacts(provider, platform, discordVersion)), {}};
    const std::string entitlements = provided(provider.entitlementsAsPlist);
    if (!entitlements.empty())
    {
        report.attachments.emplace_back("Entitlements", entitlements);
    }
    return report;
}

std::string perform(ToolboxContext &context, const std::string &action, const std::string &argument)
{
    if (action == "wipe")
    {
        const auto kind = addonKindNamed(argument);
        return flag(kind && wipeAddons(context.documents, *kind));
    }
    if (action == "factory-reset")
    {
        return flag(factoryReset(context.documents));
    }
    if (action == "delete-bundle")
    {
        deleteBundle(context.settings, context.updater, context.documents);
        return flag(true);
    }
    if (action == "custom-bundle")
    {
        return flag(useCustomBundle(context.settings, argument));
    }
    if (action == "toggle-recovery")
    {
        return flag(toggleRecovery(context.settings));
    }
    if (action == "recovery-shortcut")
    {
        const RecoveryToggle toggle = toggleRecoveryFromShortcut(
            context.settings, context.bundleReady && context.bundleReady());
        return nlohmann::json{{"enabled", toggle.enabled},
                              {"status", toggle.status},
                              {"restartRequired", toggle.restartRequired}}
            .dump();
    }
    if (action == "recovery-shortcut-action")
    {
        return kRecoveryShortcutAction;
    }
    if (action == "recovery-shortcut-activate")
    {
        const std::optional<RecoveryToggle> toggle = activateShortcut(
            context.settings, context.bundleReady && context.bundleReady(), argument);
        if (!toggle)
        {
            return nlohmann::json{{"handled", false}}.dump();
        }
        return nlohmann::json{{"handled", true},
                              {"enabled", toggle->enabled},
                              {"status", toggle->status},
                              {"restartRequired", toggle->restartRequired}}
            .dump();
    }
    if (action == "recovery-shortcut-order")
    {
        const nlohmann::json     types = nlohmann::json::parse(argument, nullptr, false);
        std::vector<std::string> names;
        if (types.is_array())
        {
            for (const auto &type : types)
            {
                names.push_back(type.is_string() ? type.get<std::string>() : std::string());
            }
        }
        return nlohmann::json(shortcutsAfterRecovery(names)).dump();
    }
    if (action == "refetch-bundle")
    {
        return flag(refetchBundle(context.updater,
                                  context.updateURL ? context.updateURL() : std::nullopt,
                                  context.bytecodeVersion ? context.bytecodeVersion() : 0));
    }
    if (action == "settings")
    {
        return context.settings.serialize();
    }
    if (action == "save-settings")
    {
        return devoverlay::editResultJSON(devoverlay::saveSettings(context.settings, argument))
            .dump();
    }
    if (action == "developer-menu")
    {
        return devoverlay::menuJSON(context.settings).dump();
    }
    if (action == "issue-url")
    {
        const auto provider = currentNativePlatformProvider();
        return issueURL(issueReport(provider ? *provider : NativePlatformProvider{},
                                    context.platform, argument));
    }
    if (action == "menu")
    {
        return menuJSON(context.settings, menuOptions(argument)).dump();
    }
    if (action == "hold-milliseconds")
    {
        return std::to_string(kThreeFingerHoldMilliseconds);
    }
    if (action == "menu-step")
    {
        return menuStepFor(argument);
    }
    if (action == "menu-outcome")
    {
        return menuOutcomeFor(argument);
    }
    return "";
}

std::string issueBody(const IssueReport &report)
{
    std::string body = "### Environment\n";

    for (const auto &[name, value] : report.environment)
    {
        body += "- **" + name + "**: " + value + "\n";
    }

    for (const auto &[title, content] : report.attachments)
    {
        body += "\n### " + title + "\n```\n" + content + "\n```\n";
    }

    body += "\n### Issue Description\n"
            "<!-- Describe the issue you're experiencing -->\n\n"
            "**Steps to reproduce:**\n1. \n2. \n3. \n\n"
            "**Expected behavior:**\n\n"
            "**Actual behavior:**\n\n";
    return body;
}

std::string issueURL(const IssueReport &report)
{
    const std::string title = "bug(" + report.platform + "): replace this with a descriptive title";

    return std::string("https://github.com/") + kIssueRepository +
           "/issues/new?title=" + percentEncode(title) +
           "&body=" + percentEncode(issueBody(report));
}
}
