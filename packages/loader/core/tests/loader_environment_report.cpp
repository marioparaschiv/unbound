#include <cassert>
#include <string>
#include <vector>

#include "LoaderEnvironmentReport.h"

namespace report = loader::environment_report;

namespace {
void recognisesBetaBuilds()
{
    assert(report::isBetaBuild("23A5276f"));
    assert(report::isBetaBuild("22F5059b"));
    assert(!report::isBetaBuild("23A341"));
    assert(!report::isBetaBuild("22F76"));
    assert(!report::isBetaBuild(""));
}

void listsDeviceMarkers()
{
    report::AppleDeviceFacts apple;
    apple.developerMode   = true;
    apple.lockdownMode    = true;
    apple.iPhoneAppOnIPad = true;
    assert((report::appleMarkers(apple) ==
            std::vector<std::string>{"Developer Mode on", "Lockdown Mode", "iPhone app on iPad"}));

    report::AndroidDeviceFacts android;
    android.selinuxEnforcing  = false;
    android.verifiedBootState = "orange";
    android.buildTags         = "test-keys";
    android.pageSize          = 16384;
    android.webView           = "com.google.android.webview 131";
    assert((report::androidMarkers(android) ==
            std::vector<std::string>{"SELinux permissive", "boot orange", "test-keys",
                                     "16 KB pages", "WebView com.google.android.webview 131"}));
    android.customROM = "LineageOS 22.1";
    assert(report::androidMarkers(android)[2] == "LineageOS 22.1");
}

void judgesInterceptedHttps()
{
    report::HttpsCheck direct{true, {"WE1", "GTS Root R4"}, ""};
    assert(report::httpsVerdict(direct)["intercepted"] == false);
    report::HttpsCheck proxied{true, {"mitmproxy"}, ""};
    nlohmann::json     verdict = report::httpsVerdict(proxied);
    assert(verdict["intercepted"] == true && verdict["issuer"] == "mitmproxy");
    assert(report::httpsVerdict(report::HttpsCheck{}).is_null());
}

void describesAndroidInstalls()
{
    nlohmann::json facts{
        {"signer", "0123456789abcdef0123"}, {"signerSubject", "CN=LSPatch"},
        {"discordSigned", false},           {"patch", "LSPatch local"},
        {"framework", "LSPosed 1.9"},       {"missingSplits", {"config.arm64_v8a"}},
        {"profile", "work profile"}};
    assert(report::androidInstallLine(facts) ==
           "APK cert 0123456789abcdef · CN=LSPatch · re-signed · LSPatch local · LSPosed 1.9 · "
           "missing config.arm64_v8a · work profile");
}
}

int main()
{
    recognisesBetaBuilds();
    listsDeviceMarkers();
    judgesInterceptedHttps();
    describesAndroidInstalls();
    return 0;
}
