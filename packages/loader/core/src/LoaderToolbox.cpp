#include "LoaderToolbox.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <system_error>

#include "LoaderFiles.h"
#include "LoaderLog.h"

namespace loader::toolbox
{
    static std::string lowercase(std::string value)
    {
        std::transform(value.begin(), value.end(), value.begin(),
                       [](unsigned char character) { return std::tolower(character); });
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
        const bool enabled = !settings.getBoolean("unbound", "recovery", false);

        settings.set("unbound", "recovery", enabled);
        settings.save();
        return enabled;
    }

    bool refetchBundle(BundleUpdater &updater, const std::optional<std::string> &updateURL,
                       uint32_t bytecodeVersion)
    {
        try
        {
            return fileExists(updater.downloadBundle(updater.resolveBundlePath(), updateURL, bytecodeVersion));
        }
        catch (const std::exception &error)
        {
            log(LogLevel::Error, "updater", std::string("Refetching the bundle failed: ") + error.what());
            return false;
        }
    }

    static std::string flag(bool value)
    {
        return value ? "true" : "false";
    }

    std::vector<std::pair<std::string, std::string>> issueEnvironment(const IssueFacts &facts)
    {
        const auto known = [](const std::string &value) { return value.empty() ? std::string("unknown") : value; };
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
        if (!facts.registration.empty())
        {
            rows.emplace_back("App Registration", facts.registration);
        }
        rows.emplace_back("Virtual Device", facts.virtualDevice ? "Yes" : "No");
        return rows;
    }

    static std::string text(const nlohmann::json &object, const char *key)
    {
        const auto value = object.find(key);
        return value != object.end() && value->is_string() ? value->get<std::string>() : std::string();
    }

    static IssueReport issueReportFrom(const std::string &platform, const std::string &argument)
    {
        const nlohmann::json input = nlohmann::json::parse(argument, nullptr, false);
        const nlohmann::json facts =
            input.is_object() && input.contains("facts") && input["facts"].is_object() ? input["facts"]
                                                                                       : nlohmann::json::object();
        IssueReport report{platform,
                           issueEnvironment({platform, text(facts, "device"), text(facts, "osVersion"),
                                             text(facts, "discordVersion"), text(facts, "unboundVersion"),
                                             text(facts, "appSource"), text(facts, "registration"),
                                             facts.value("virtualDevice", false)}),
                           {}};

        const auto attachments = input.is_object() ? input.find("attachments") : input.end();
        if (input.is_object() && attachments != input.end() && attachments->is_array())
        {
            for (const auto &entry : *attachments)
            {
                if (entry.is_array() && entry.size() == 2 && entry[0].is_string() && entry[1].is_string())
                {
                    report.attachments.emplace_back(entry[0].get<std::string>(), entry[1].get<std::string>());
                }
            }
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
        if (action == "refetch-bundle")
        {
            return flag(refetchBundle(context.updater, context.updateURL ? context.updateURL() : std::nullopt,
                                      context.bytecodeVersion ? context.bytecodeVersion() : 0));
        }
        if (action == "settings")
        {
            return context.settings.serialize();
        }
        if (action == "replace-settings")
        {
            return flag(context.settings.replace(argument) && context.settings.save());
        }
        if (action == "issue-url")
        {
            return issueURL(issueReportFrom(context.platform, argument));
        }
        if (action == "message")
        {
            if (argument == "refetch-failed")
            {
                return kRefetchFailedMessage;
            }
            if (argument == "custom-bundle-invalid")
            {
                return kCustomBundleInvalidText;
            }
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
               "/issues/new?title=" + percentEncode(title) + "&body=" + percentEncode(issueBody(report));
    }
}
