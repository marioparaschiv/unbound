#include <cassert>
#include <cctype>
#include <filesystem>
#include <memory>
#include <string>
#include <unistd.h>

#include "LoaderToolbox.h"
#include "LoaderVersion.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-toolbox-issue-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static std::string row(const loader::toolbox::IssueReport &report, const std::string &name)
{
    for (const auto &[key, value] : report.environment)
    {
        if (key == name)
        {
            return value;
        }
    }
    return "<missing>";
}

int main()
{
    loader::NativePlatformProvider ios;
    ios.platform    = "ios";
    ios.deviceModel = [] {
        return std::string("iPhone SE");
    };
    ios.osVersion = [] {
        return std::string("26.0.1");
    };
    ios.isSystemApp = [] {
        return true;
    };
    ios.appSource = [] {
        return std::string("TrollStore");
    };
    ios.isVirtualDevice = [] {
        return false;
    };
    ios.entitlementsAsPlist = [] {
        return std::string("<plist/>");
    };

    const auto report = loader::toolbox::issueReport(ios, "iOS", "300.0 (1234)");
    assert(report.platform == "iOS");
    assert(row(report, "Device") == "iPhone SE");
    assert(row(report, "iOS Version") == "26.0.1");
    assert(row(report, "Discord Version") == "300.0 (1234)");
    assert(row(report, "Unbound Version") == loader::loaderVersion());
    assert(std::isdigit(static_cast<unsigned char>(loader::loaderVersion()[0])));
    assert(row(report, "App Source") == "TrollStore");
    assert(row(report, "App Registration") == "System");
    assert(row(report, "Virtual Device") == "No");
    assert(report.attachments.size() == 1);
    assert(report.attachments[0].first == "Entitlements" &&
           report.attachments[0].second == "<plist/>");

    loader::NativePlatformProvider android;
    android.platform    = "android";
    android.deviceModel = [] {
        return std::string("Google Pixel 9");
    };
    android.osVersion = [] {
        return std::string("16");
    };
    android.isSystemApp = [] {
        return false;
    };
    android.appSource = [] {
        return std::string("Google Play");
    };
    android.isVirtualDevice = [] {
        return true;
    };
    android.framework = [] {
        return std::string("Vector");
    };

    const auto androidReport = loader::toolbox::issueReport(android, "Android", "");
    assert(row(androidReport, "Android Version") == "16");
    assert(row(androidReport, "Discord Version") == "unknown");
    assert(row(androidReport, "App Source") == "Google Play");
    assert(row(androidReport, "Framework") == "Vector");
    assert(row(androidReport, "App Registration") == "User");
    assert(row(androidReport, "Virtual Device") == "Yes");
    assert(androidReport.attachments.empty());

    const auto bare = loader::toolbox::issueReport({}, "Android", "1.0");
    assert(row(bare, "Device") == "unknown");
    assert(row(bare, "App Registration") == "<missing>");
    assert(row(bare, "App Source") == "<missing>");

    const auto            root = makeTemporaryDirectory();
    loader::SettingsStore settings((root / "settings.json").string());
    settings.load();
    loader::BundleUpdater updater(
        root.string(), loader::updaterSettings(settings),
        [](const std::string &, double) -> std::optional<std::string> {
            return std::nullopt;
        },
        [](const std::string &, const std::string &, const std::map<std::string, std::string> &,
           const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            return std::nullopt;
        });
    loader::toolbox::ToolboxContext context{settings,
                                            updater,
                                            root.string(),
                                            "iOS",
                                            [] {
                                                return std::optional<std::string>();
                                            },
                                            [] {
                                                return 96u;
                                            }};

    loader::setNativePlatformProvider(std::make_shared<loader::NativePlatformProvider>(ios));
    const std::string issue = loader::toolbox::perform(context, "issue-url", "300.0 (1234)");
    assert(issue.find("bug%28iOS%29") != std::string::npos);
    assert(issue.find("iPhone%20SE") != std::string::npos);
    assert(issue.find("Device") < issue.find("iOS%20Version"));
    assert(issue.find("300.0%20%281234%29") != std::string::npos);
    assert(issue.find("App%20Registration%2A%2A%3A%20System") != std::string::npos);
    assert(issue.find("Entitlements") != std::string::npos);
    assert(loader::currentNativePlatformProvider()->platform == "ios");

    loader::setNativePlatformProvider(nullptr);
    const std::string unknown = loader::toolbox::perform(context, "issue-url", "");
    assert(unknown.find("Device%2A%2A%3A%20unknown") != std::string::npos);

    std::filesystem::remove_all(root);
    return 0;
}
