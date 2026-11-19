#include "LoaderEnvironmentReport.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>
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

bool isBetaBuild(const std::string &build)
{
    size_t letter = 0;
    while (letter < build.size() && std::isdigit(static_cast<unsigned char>(build[letter])))
    {
        letter++;
    }

    if (letter == 0 || letter + 1 >= build.size()
        || !std::isupper(static_cast<unsigned char>(build[letter])))
    {
        return false;
    }

    std::string rest = build.substr(letter + 1);
    return rest.size() >= 5 && rest[0] == '5'
           && std::islower(static_cast<unsigned char>(rest.back()));
}

std::vector<std::string> localeMarkers(const LocaleFacts &facts)
{
    std::vector<std::string> markers;
    if (!facts.calendar.empty() && facts.calendar != "gregorian")
    {
        markers.push_back(facts.calendar + " calendar");
    }

    if (facts.nonLatinDigits)
    {
        markers.emplace_back("non-Latin digits");
    }

    if (facts.rightToLeft)
    {
        markers.emplace_back("right-to-left language");
    }

    return markers;
}

std::vector<std::string> displayMarkers(int refreshRate, bool boldText)
{
    constexpr int kUsualRefreshRate = 60;
    std::vector<std::string> markers;
    if (refreshRate > kUsualRefreshRate)
    {
        markers.push_back(std::to_string(refreshRate) + " Hz");
    }

    if (boldText)
    {
        markers.emplace_back("bold text");
    }

    return markers;
}

static void append(std::vector<std::string> &markers, const std::vector<std::string> &more)
{
    markers.insert(markers.end(), more.begin(), more.end());
}

std::string duplicateCopyMarker(const std::string &path)
{
    if (path.empty())
    {
        return "";
    }

    const size_t slash = path.find_last_of('/');
    return "second Unbound copy skipped ("
           + (slash == std::string::npos ? path : path.substr(slash + 1)) + ")";
}

std::vector<std::string> appleMarkers(const AppleDeviceFacts &facts)
{
    std::vector<std::string> markers;
    if (!facts.duplicateCopy.empty())
    {
        markers.push_back(duplicateCopyMarker(facts.duplicateCopy));
    }

    if (!facts.modelEdit.empty())
    {
        markers.push_back(facts.modelEdit);
    }

    if (!facts.jailbreakVersion.empty())
    {
        markers.push_back(facts.jailbreakVersion);
    }

    if (facts.iOSAppOnVision)
    {
        markers.emplace_back("iPhone app on Vision Pro");
    }

    if (facts.sideStoreVPN)
    {
        markers.emplace_back("SideStore pairing VPN");
    }

    if (facts.liveContainerMultitask)
    {
        markers.emplace_back("LiveContainer multitasking");
    }

    if (facts.lockdownMode)
    {
        markers.emplace_back("Lockdown Mode");
    }

    if (facts.iPhoneAppOnIPad)
    {
        markers.emplace_back("iPhone app on iPad");
    }

    if (facts.iOSAppOnMac)
    {
        markers.emplace_back("iPhone app on Mac");
    }

    if (facts.managedApp)
    {
        markers.emplace_back("MDM-managed");
    }

    if (facts.debuggerAttached)
    {
        markers.emplace_back("debugger attached");
    }
    else if (facts.jitEnabled)
    {
        markers.emplace_back("JIT enabled");
    }

    if (facts.trollFools)
    {
        markers.emplace_back("TrollFools injection");
    }

    if (facts.appSync)
    {
        markers.emplace_back("AppSync Unified");
    }

    append(markers, displayMarkers(facts.refreshRate, facts.boldText));
    append(markers, localeMarkers(facts.locale));
    return markers;
}

static bool isUsualWebView(const std::string &webView)
{
    static const std::vector<std::string> standard = {
        "com.google.android.webview ", "com.android.webview ", "com.android.chrome "};
    constexpr int kOldMajor = 120;
    for (const std::string &package : standard)
    {
        if (webView.starts_with(package))
        {
            return std::atoi(webView.c_str() + package.size()) >= kOldMajor;
        }
    }

    return false;
}

static std::vector<std::string> backgroundLimits(const AndroidDeviceFacts &facts)
{
    constexpr int kRareBucket       = 40;
    constexpr int kRestrictedBucket = 45;
    std::vector<std::string> limits;
    if (facts.backgroundRestricted)
    {
        limits.emplace_back("bg restricted");
    }

    if (facts.standbyBucket >= kRestrictedBucket)
    {
        limits.emplace_back("standby restricted");
    }
    else if (facts.standbyBucket >= kRareBucket)
    {
        limits.emplace_back("standby rare");
    }

    if (!limits.empty() && facts.batteryOptimized)
    {
        limits.emplace_back("battery optimized");
    }

    return limits;
}

std::vector<std::string> androidMarkers(const AndroidDeviceFacts &facts)
{
    std::vector<std::string> markers;
    if (!facts.duplicateCopy.empty())
    {
        markers.push_back(duplicateCopyMarker(facts.duplicateCopy));
    }

    if (facts.selinuxEnforcing && !*facts.selinuxEnforcing)
    {
        markers.emplace_back("SELinux permissive");
    }

    if (!facts.verifiedBootState.empty() && facts.verifiedBootState != "green")
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

    if (!facts.webView.empty() && !isUsualWebView(facts.webView))
    {
        markers.push_back("WebView " + facts.webView);
    }

    if (!facts.host.empty())
    {
        markers.push_back(facts.host);
    }

    std::vector<std::string> background = backgroundLimits(facts);
    if (!background.empty() && !facts.skin.empty())
    {
        markers.push_back(facts.skin);
    }

    markers.insert(markers.end(), background.begin(), background.end());
    if (!facts.abiBridge.empty() && facts.abiBridge != "0")
    {
        markers.push_back("ABI translation (" + facts.abiBridge + ")");
    }

    if (facts.lowRam)
    {
        markers.emplace_back("low-RAM device");
    }

    if (facts.harmonyOS)
    {
        markers.emplace_back("HarmonyOS");
    }

    if (facts.adoptableStorage)
    {
        markers.emplace_back("installed on adoptable storage");
    }

    if (!facts.formFactor.empty())
    {
        markers.push_back(facts.formFactor);
    }

    append(markers, displayMarkers(facts.refreshRate, facts.boldText));
    append(markers, localeMarkers(facts.locale));
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
    std::string signer = facts.value("signer", std::string());
    if (!signer.empty())
    {
        parts.push_back("APK cert " + signer.substr(0, 16));
        parts.push_back(facts.value("signerSubject", std::string()));
        if (!facts.value("discordSigned", false))
        {
            parts.emplace_back("re-signed");
        }
    }

    parts.push_back(facts.value("patch", std::string()));
    parts.push_back(facts.value("framework", std::string()));
    nlohmann::json missing = facts.value("missingSplits", nlohmann::json::array());
    bool incomplete        = false;
    for (const nlohmann::json &name : missing)
    {
        if (name.is_string())
        {
            parts.push_back("missing " + name.get<std::string>());
            incomplete = true;
        }
    }

    if (!incomplete && facts.value("splits", 0) > 0)
    {
        parts.push_back(std::to_string(facts.value("splits", 0)) + " splits");
    }

    if (facts.value("merged", false))
    {
        parts.emplace_back("merged split APK");
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
