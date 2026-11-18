#import "EnvironmentReport.h"

#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <UIKit/UIKit.h>
#include <sys/sysctl.h>
#include <unistd.h>

#import "CoreConversions.h"
#include "JailbreakDetection.h"
#include "LoaderBinaryAnatomy.h"
#include "LoaderEnvironmentReport.h"
#import "Utilities.h"

using unbound::ios::toStdString;
namespace report = loader::environment_report;

static NSString *const kHttpsProbeURL   = @"https://discord.com/api/v9/gateway";
static const int64_t kHttpsCheckDelayNs = 20 * NSEC_PER_SEC;

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
        CFIndex count    = chain ? CFArrayGetCount(chain) : 0;
        for (CFIndex index = 1; index < count; index++)
        {
            auto certificate    = (SecCertificateRef) CFArrayGetValueAtIndex(chain, index);
            CFStringRef summary = SecCertificateCopySubjectSummary(certificate);
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

static std::string osBuild()
{
    char build[32] = {0};
    size_t size    = sizeof(build);
    return sysctlbyname("kern.osversion", build, &size, nullptr, 0) == 0 ? std::string(build) : "";
}

static bool supportsIPad()
{
    NSArray *families = NSBundle.mainBundle.infoDictionary[@"UIDeviceFamily"];
    return [families isKindOfClass:NSArray.class] && [families containsObject:@2];
}

static bool isManagedApp()
{
    id configuration =
        [NSUserDefaults.standardUserDefaults objectForKey:@"com.apple.configuration.managed"];
    return [configuration isKindOfClass:NSDictionary.class] && [configuration count] > 0;
}

static bool isJITEnabled()
{
    uint32_t flags = 0;
    return csops(getpid(), 0, &flags, sizeof(flags)) == 0 && (flags & CS_DEBUGGED) != 0;
}

static bool isDebuggerAttached()
{
    struct kinfo_proc info = {};
    size_t size            = sizeof(info);
    int name[]             = {CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()};
    return sysctl(name, 4, &info, &size, nullptr, 0) == 0 && (info.kp_proc.p_flag & P_TRACED) != 0;
}

static bool hasTrollFoolsBackup()
{
    NSString *bundle           = NSBundle.mainBundle.bundlePath;
    NSArray<NSString *> *names = [NSFileManager.defaultManager contentsOfDirectoryAtPath:bundle
                                                                                   error:nil];
    for (NSString *name in names)
    {
        if ([name hasSuffix:@".troll-fools.bak"])
        {
            return true;
        }
    }

    return false;
}

static bool hasAppSyncUnified()
{
    NSArray<NSString *> *roots = @[ @"", @"/var/jb" ];
    for (NSString *root in roots)
    {
        NSString *path =
            [root stringByAppendingString:
                      @"/Library/MobileSubstrate/DynamicLibraries/AppSyncUnified-installd.dylib"];
        if ([NSFileManager.defaultManager fileExistsAtPath:path])
        {
            return true;
        }
    }

    return false;
}

static report::AppleDeviceFacts deviceFacts()
{
    report::AppleDeviceFacts facts;
    facts.lockdownMode = [NSUserDefaults.standardUserDefaults boolForKey:@"LDMGlobalEnabled"];
    facts.iPhoneAppOnIPad =
        UIDevice.currentDevice.userInterfaceIdiom == UIUserInterfaceIdiomPad && !supportsIPad();
    facts.iOSAppOnMac      = NSProcessInfo.processInfo.isiOSAppOnMac;
    facts.managedApp       = isManagedApp();
    facts.jitEnabled       = detectedJailbreak().empty() && isJITEnabled();
    facts.debuggerAttached = isDebuggerAttached();
    facts.trollFools       = hasTrollFoolsBackup();
    facts.appSync          = hasAppSyncUnified();
    return facts;
}

static nlohmann::json binaryReport()
{
    nlohmann::json report = nlohmann::json::object();
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
    static nlohmann::json cached;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        cached            = binaryReport();
        std::string build = osBuild();
        if (report::isBetaBuild(build))
        {
            cached["osBeta"] = build;
        }
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
                                           failed.failure = toStdString(error.domain) + " "
                                                            + std::to_string((long) error.code);
                                           report::recordHttpsCheck(std::move(failed));
                                       }

                                       [session finishTasksAndInvalidate];
                                   }] resume];
                   });
}
