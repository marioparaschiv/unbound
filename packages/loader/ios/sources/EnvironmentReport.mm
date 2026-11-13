#import "EnvironmentReport.h"

#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <UIKit/UIKit.h>
#include <sys/sysctl.h>

#import "CoreConversions.h"
#include "LoaderBinaryAnatomy.h"
#include "LoaderEnvironmentReport.h"
#import "Utilities+CodeSignature.h"
#import "Utilities.h"

using unbound::ios::toStdString;
namespace report = loader::environment_report;

static NSString *const kHttpsProbeURL     = @"https://discord.com/api/v9/gateway";
static const int64_t   kHttpsCheckDelayNs = 20 * NSEC_PER_SEC;

@interface HttpsChainRecorder : NSObject <NSURLSessionDelegate>
@end

@implementation HttpsChainRecorder

- (void)URLSession:(NSURLSession *)session
    didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
      completionHandler:
          (void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completionHandler
{
    SecTrustRef trust = challenge.protectionSpace.serverTrust;
    if (trust)
    {
        report::HttpsCheck check;
        check.completed  = true;
        CFArrayRef chain = SecTrustCopyCertificateChain(trust);
        CFIndex    count = chain ? CFArrayGetCount(chain) : 0;
        for (CFIndex index = 1; index < count; index++)
        {
            auto        certificate = (SecCertificateRef) CFArrayGetValueAtIndex(chain, index);
            CFStringRef summary     = SecCertificateCopySubjectSummary(certificate);
            if (summary)
            {
                check.issuers.push_back(toStdString((__bridge NSString *) summary));
                CFRelease(summary);
            }
        }
        if (chain)
        {
            CFRelease(chain);
        }
        report::recordHttpsCheck(std::move(check));
    }
    completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, nil);
}

@end

static std::optional<bool> developerMode()
{
    int    status = 0;
    size_t size   = sizeof(status);
    if (sysctlbyname("security.mac.amfi.developer_mode_status", &status, &size, nullptr, 0) != 0)
    {
        return std::nullopt;
    }
    return status != 0;
}

static std::string osBuild()
{
    char   build[32] = {0};
    size_t size      = sizeof(build);
    return sysctlbyname("kern.osversion", build, &size, nullptr, 0) == 0 ? std::string(build) : "";
}

static bool supportsIPad()
{
    NSArray *families = NSBundle.mainBundle.infoDictionary[@"UIDeviceFamily"];
    return [families isKindOfClass:NSArray.class] && [families containsObject:@2];
}

static std::vector<std::string> stringsOf(id value)
{
    std::vector<std::string> list;
    if ([value isKindOfClass:NSArray.class])
    {
        for (id item in (NSArray *) value)
        {
            if ([item isKindOfClass:NSString.class])
            {
                list.push_back(toStdString(item));
            }
        }
    }
    return list;
}

static std::vector<std::string> bundledExtensions()
{
    NSString                *plugIns = NSBundle.mainBundle.builtInPlugInsPath;
    std::vector<std::string> names;
    for (NSString *name in [NSFileManager.defaultManager contentsOfDirectoryAtPath:plugIns
                                                                             error:nil])
    {
        if ([name.pathExtension isEqualToString:@"appex"])
        {
            names.push_back(toStdString(name.stringByDeletingPathExtension));
        }
    }
    return names;
}

static report::ResignFacts resignFacts()
{
    NSDictionary       *entitlements = [Utilities getApplicationEntitlements];
    report::ResignFacts facts;
    facts.bundleIdentifier = toStdString(NSBundle.mainBundle.bundleIdentifier ?: @"");
    facts.push             = entitlements[@"aps-environment"] != nil;
    std::vector<std::string> groups =
        stringsOf(entitlements[@"com.apple.security.application-groups"]);
    facts.appGroup =
        std::find(groups.begin(), groups.end(), report::kDiscordAppGroup) != groups.end();
    facts.keychainGroups     = stringsOf(entitlements[@"keychain-access-groups"]);
    facts.extensions         = bundledExtensions();
    facts.expectedExtensions = {"BroadcastUpload", "LockscreenWidget", "NotificationService",
                                "Share"};
    return facts;
}

static report::AppleDeviceFacts deviceFacts()
{
    report::AppleDeviceFacts facts;
    facts.developerMode = developerMode();
    facts.lockdownMode  = [NSUserDefaults.standardUserDefaults boolForKey:@"LDMGlobalEnabled"];
    facts.osBuild       = osBuild();
    facts.iPhoneAppOnIPad =
        UIDevice.currentDevice.userInterfaceIdiom == UIUserInterfaceIdiomPad && !supportsIPad();
    facts.iOSAppOnMac = NSProcessInfo.processInfo.isiOSAppOnMac;
    return facts;
}

static nlohmann::json binaryReport()
{
    nlohmann::json                         report = nlohmann::json::object();
    std::optional<loader::binary::Anatomy> anatomy =
        loader::binary::readAnatomy(toStdString(NSBundle.mainBundle.executablePath));
    if (!anatomy)
    {
        return report;
    }
    report["binary"] =
        loader::binary::anatomyLine(*anatomy, toStdString(NSBundle.mainBundle.bundlePath));
    if (std::optional<loader::binary::Certificate> signer =
            loader::binary::signer(anatomy->signature))
    {
        report["signer"] = loader::binary::signerLine(*signer);
    }
    return report;
}

nlohmann::json UnboundEnvironmentReport()
{
    static nlohmann::json  cached;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        cached           = binaryReport();
        cached["resign"] = report::resignNotes(resignFacts());
    });
    nlohmann::json environment = cached;
    environment["markers"]     = report::appleMarkers(deviceFacts());
    return environment;
}

void UnboundStartHttpsCheck()
{
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, kHttpsCheckDelayNs),
                   dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
                       NSURLSessionConfiguration *configuration =
                           NSURLSessionConfiguration.ephemeralSessionConfiguration;
                       configuration.timeoutIntervalForRequest = 15;
                       NSURLSession *session =
                           [NSURLSession sessionWithConfiguration:configuration
                                                         delegate:[HttpsChainRecorder new]
                                                    delegateQueue:nil];
                       NSMutableURLRequest *request = [NSMutableURLRequest
                           requestWithURL:[NSURL URLWithString:kHttpsProbeURL]];
                       request.HTTPMethod           = @"HEAD";
                       [[session dataTaskWithRequest:request
                                   completionHandler:^(NSData *, NSURLResponse *, NSError *error) {
                                       if (error && !report::currentHttpsCheck().completed)
                                       {
                                           report::HttpsCheck failed;
                                           failed.failure = toStdString(error.domain) + " " +
                                                            std::to_string((long) error.code);
                                           report::recordHttpsCheck(std::move(failed));
                                       }
                                       [session finishTasksAndInvalidate];
                                   }] resume];
                   });
}
