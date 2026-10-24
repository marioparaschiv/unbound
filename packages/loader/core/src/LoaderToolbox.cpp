#include "LoaderToolbox.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <system_error>

#include "LoaderFiles.h"

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

    bool useCustomBundle(SettingsStore &settings, const std::string &url)
    {
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
