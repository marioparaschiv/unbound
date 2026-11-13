#include "LoaderInjectedLibraries.h"

#include <algorithm>
#include <array>
#include <set>
#include <sstream>
#include <string_view>

namespace loader {
namespace {
    constexpr std::array<std::string_view, 2> kTweakDirectories = {"/TweakInject/",
                                                                   "/DynamicLibraries/"};

    constexpr std::array<std::string_view, 16> kIOSInjectionFramework = {
        "unbound",        "ellekit",           "libellekit",   "libsubstrate",
        "cydiasubstrate", "libhooker",         "libblackjack", "tweakinject",
        "tweakloader",    "libinjector",       "systemhook",   "libroot",
        "libsubstitute",  "substitute-loader", "libsandy",     "libkrw"};

    constexpr std::array<std::string_view, 9> kAndroidSystemPackages = {
        "app.unbound.android",
        "org.lsposed.manager",
        "com.google.android.webview",
        "com.google.android.trichromelibrary",
        "com.android.chrome",
        "com.google.android.gms",
        "com.google.android.gsf",
        "com.android.webview",
        "com.google.android.apps.photos"};

    std::string lowercase(std::string value)
    {
        std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
            return static_cast<char>(std::tolower(character));
        });
        return value;
    }

    std::string baseName(const std::string &path)
    {
        const size_t slash = path.find_last_of('/');
        return slash == std::string::npos ? path : path.substr(slash + 1);
    }

    std::string withoutSuffix(const std::string &name, std::string_view suffix)
    {
        return name.ends_with(suffix) ? name.substr(0, name.size() - suffix.size()) : name;
    }

    bool isTweak(const std::string &path)
    {
        return std::any_of(kTweakDirectories.begin(), kTweakDirectories.end(),
                           [&](std::string_view directory) {
                               return path.find(directory) != std::string::npos;
                           });
    }

    bool isInjectionFramework(const std::string &name)
    {
        const std::string lower = lowercase(name);
        return std::any_of(kIOSInjectionFramework.begin(), kIOSInjectionFramework.end(),
                           [&](std::string_view framework) {
                               return lower.starts_with(framework);
                           });
    }

    bool isLooseInAppBundle(const std::string &path)
    {
        return path.find(".app/") != std::string::npos &&
               path.find(".framework/") == std::string::npos;
    }

    std::string packageOf(const std::string &path)
    {
        constexpr std::string_view kApps = "/data/app/";
        if (!path.starts_with(kApps))
        {
            return "";
        }
        std::string rest = path.substr(kApps.size());
        if (rest.starts_with("~~"))
        {
            const size_t slash = rest.find('/');
            if (slash == std::string::npos)
            {
                return "";
            }
            rest = rest.substr(slash + 1);
        }
        const size_t end       = rest.find('/');
        std::string  directory = end == std::string::npos ? rest : rest.substr(0, end);
        const size_t dash      = directory.find('-');
        return dash == std::string::npos ? directory : directory.substr(0, dash);
    }

    std::string magiskModuleOf(const std::string &path)
    {
        constexpr std::string_view kModules = "/data/adb/modules/";
        const size_t               start    = path.find(kModules);
        if (start == std::string::npos)
        {
            return "";
        }
        std::string  rest = path.substr(start + kModules.size());
        const size_t end  = rest.find('/');
        return end == std::string::npos ? "" : rest.substr(0, end);
    }

    bool isSystemPackage(const std::string &package)
    {
        return std::any_of(kAndroidSystemPackages.begin(), kAndroidSystemPackages.end(),
                           [&](std::string_view known) {
                               return package.starts_with(known);
                           });
    }
}

std::vector<std::string> injectedIOSLibraries(const std::vector<std::string> &imagePaths)
{
    std::set<std::string> found;
    for (const std::string &path : imagePaths)
    {
        if (!path.ends_with(".dylib") || (!isTweak(path) && !isLooseInAppBundle(path)))
        {
            continue;
        }
        const std::string name = withoutSuffix(baseName(path), ".dylib");
        if (name.empty() || isInjectionFramework(name) || lowercase(name).starts_with("libswift"))
        {
            continue;
        }
        found.insert(name);
    }
    return {found.begin(), found.end()};
}

std::vector<std::string> injectedAndroidModules(const std::string &memoryMaps,
                                                const std::string &ownPackage)
{
    std::set<std::string> found;
    std::istringstream    lines(memoryMaps);
    std::string           line;
    while (std::getline(lines, line))
    {
        const size_t start = line.find('/');
        if (start == std::string::npos)
        {
            continue;
        }
        const std::string path = line.substr(start);
        if (std::string module = magiskModuleOf(path); !module.empty())
        {
            found.insert(module);
            continue;
        }
        if (!path.ends_with(".apk") && !path.ends_with(".so"))
        {
            continue;
        }
        const std::string package = packageOf(path);
        if (package.empty() || package == ownPackage || isSystemPackage(package))
        {
            continue;
        }
        found.insert(package);
    }
    return {found.begin(), found.end()};
}
}
