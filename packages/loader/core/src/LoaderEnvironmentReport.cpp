#include "LoaderEnvironmentReport.h"

#include <algorithm>
#include <cctype>
#include <mutex>

namespace loader::environment_report {
namespace {
    std::mutex httpsMutex;
    HttpsCheck latestHttpsCheck;

    const std::vector<std::string> kPublicRoots = {
        "GTS Root",   "Google Trust Services",
        "ISRG Root",  "Let's Encrypt",
        "DigiCert",   "Baltimore CyberTrust",
        "Sectigo",    "USERTrust",
        "GlobalSign", "Amazon Root",
        "Amazon RSA", "Amazon ECDSA",
        "Starfield",  "Go Daddy",
        "Entrust",    "Comodo",
        "WE1",        "WR1",
        "E5",         "E6",
        "R10",        "R11",
    };

    bool contains(const std::vector<std::string> &list, const std::string &value)
    {
        return std::find(list.begin(), list.end(), value) != list.end();
    }

    bool isPublicIssuer(const std::string &issuer)
    {
        return std::any_of(kPublicRoots.begin(), kPublicRoots.end(), [&](const std::string &root) {
            return issuer.starts_with(root);
        });
    }

    std::string joinedWith(const std::vector<std::string> &parts, const std::string &separator)
    {
        std::string text;
        for (const std::string &part : parts)
        {
            if (!part.empty())
            {
                text += (text.empty() ? "" : separator) + part;
            }
        }
        return text;
    }
}

std::vector<std::string> resignNotes(const ResignFacts &facts)
{
    std::vector<std::string> notes;
    if (!facts.bundleIdentifier.empty() && facts.bundleIdentifier != kDiscordBundleIdentifier)
    {
        notes.push_back("bundle id " + facts.bundleIdentifier);
    }
    if (!facts.push)
    {
        notes.emplace_back("no push");
    }
    if (!facts.appGroup)
    {
        notes.emplace_back("no app group");
    }
    bool discordKeychain = std::any_of(facts.keychainGroups.begin(), facts.keychainGroups.end(),
                                       [](const std::string &group) {
                                           return group.ends_with(".com.hammerandchisel.discord");
                                       });
    if (!facts.keychainGroups.empty() && !discordKeychain)
    {
        notes.emplace_back("keychain group changed");
    }
    std::vector<std::string> missing;
    for (const std::string &extension : facts.expectedExtensions)
    {
        if (!contains(facts.extensions, extension))
        {
            missing.push_back(extension);
        }
    }
    if (!missing.empty())
    {
        notes.push_back("no " + joinedWith(missing, ", ") +
                        (missing.size() == 1 ? " extension" : " extensions"));
    }
    return notes;
}

bool isBetaBuild(const std::string &build)
{
    size_t letter = 0;
    while (letter < build.size() && std::isdigit(static_cast<unsigned char>(build[letter])))
    {
        letter++;
    }
    if (letter == 0 || letter + 1 >= build.size() ||
        !std::isupper(static_cast<unsigned char>(build[letter])))
    {
        return false;
    }
    std::string rest = build.substr(letter + 1);
    return rest.size() >= 5 && rest[0] == '5' &&
           std::islower(static_cast<unsigned char>(rest.back()));
}

std::vector<std::string> appleMarkers(const AppleDeviceFacts &facts)
{
    std::vector<std::string> markers;
    if (facts.developerMode)
    {
        markers.emplace_back(*facts.developerMode ? "Developer Mode on" : "Developer Mode off");
    }
    if (facts.lockdownMode)
    {
        markers.emplace_back("Lockdown Mode");
    }
    if (isBetaBuild(facts.osBuild))
    {
        markers.push_back("beta OS " + facts.osBuild);
    }
    if (facts.iPhoneAppOnIPad)
    {
        markers.emplace_back("iPhone app on iPad");
    }
    if (facts.iOSAppOnMac)
    {
        markers.emplace_back("iPhone app on Mac");
    }
    return markers;
}

std::vector<std::string> androidMarkers(const AndroidDeviceFacts &facts)
{
    std::vector<std::string> markers;
    if (facts.selinuxEnforcing)
    {
        markers.emplace_back(*facts.selinuxEnforcing ? "SELinux enforcing" : "SELinux permissive");
    }
    if (!facts.verifiedBootState.empty())
    {
        markers.push_back("boot " + facts.verifiedBootState);
    }
    if (!facts.customROM.empty())
    {
        markers.push_back(facts.customROM);
    }
    else if (!facts.buildTags.empty() && facts.buildTags != "release-keys")
    {
        markers.push_back(facts.buildTags);
    }
    if (facts.pageSize > 0 && facts.pageSize != 4096)
    {
        markers.push_back(std::to_string(facts.pageSize / 1024) + " KB pages");
    }
    if (!facts.webView.empty())
    {
        markers.push_back("WebView " + facts.webView);
    }
    return markers;
}

nlohmann::json httpsVerdict(const HttpsCheck &check)
{
    if (!check.completed)
    {
        return check.failure.empty()
                   ? nlohmann::json()
                   : nlohmann::json{{"intercepted", false}, {"failure", check.failure}};
    }
    for (const std::string &issuer : check.issuers)
    {
        if (!isPublicIssuer(issuer))
        {
            return {{"intercepted", true}, {"issuer", issuer.substr(0, 96)}};
        }
    }
    nlohmann::json verdict{{"intercepted", false}};
    if (!check.issuers.empty())
    {
        verdict["issuer"] = check.issuers.back().substr(0, 96);
    }
    return verdict;
}

std::string androidInstallLine(const nlohmann::json &facts)
{
    if (!facts.is_object())
    {
        return "";
    }
    std::vector<std::string> parts;
    std::string              signer = facts.value("signer", std::string());
    if (!signer.empty())
    {
        parts.push_back(facts.value("discordSigned", false) ? "Discord's key"
                                                            : "re-signed " + signer.substr(0, 16));
    }
    parts.push_back(facts.value("patch", std::string()));
    std::string framework = facts.value("framework", std::string());
    if (!framework.empty())
    {
        parts.push_back(framework);
    }
    nlohmann::json missing = facts.value("missingSplits", nlohmann::json::array());
    if (missing.is_array() && !missing.empty())
    {
        std::vector<std::string> names;
        for (const nlohmann::json &name : missing)
        {
            if (name.is_string())
            {
                names.push_back(name.get<std::string>());
            }
        }
        parts.push_back("missing " + joinedWith(names, ", "));
    }
    else if (facts.value("splits", 0) > 0)
    {
        parts.push_back(std::to_string(facts.value("splits", 0)) + " splits");
    }
    parts.push_back(facts.value("profile", std::string()));
    return joinedWith(parts, " · ");
}

void recordHttpsCheck(HttpsCheck check)
{
    std::lock_guard<std::mutex> lock(httpsMutex);
    latestHttpsCheck = std::move(check);
}

HttpsCheck currentHttpsCheck()
{
    std::lock_guard<std::mutex> lock(httpsMutex);
    return latestHttpsCheck;
}
}
