#import "EnvironmentReport.h"

#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <UIKit/UIKit.h>
#include <arpa/inet.h>
#include <atomic>
#include <cstring>
#include <dlfcn.h>
#include <ifaddrs.h>
#include <mach-o/dyld.h>
#include <net/if.h>
#import <objc/message.h>
#include <set>
#include <sys/sysctl.h>
#include <unistd.h>

#import "CoreConversions.h"
#include "JailbreakDetection.h"
#include "LoaderBinaryAnatomy.h"
#include "LoaderEnvironmentReport.h"
#include "LoaderLeftoverMods.h"
#include "LoaderNetworkStack.h"
#import "SingleCopy.h"
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

static const std::set<long> kDynamicIslandSubtypes = {2556, 2622, 2796, 2868};
static NSString *const kSideStoreVPNPrefix         = @"10.7.0.";

static std::string machineName()
{
    char machine[64] = {};
    size_t size      = sizeof(machine);
    return sysctlbyname("hw.machine", machine, &size, nullptr, 0) == 0 ? machine : "";
}

static long artworkSubtype()
{
    using CopyAnswer = CFTypeRef (*)(CFStringRef);
    void *library    = dlopen("/usr/lib/libMobileGestalt.dylib", RTLD_LAZY);
    auto copyAnswer  = library ? (CopyAnswer) dlsym(library, "MGCopyAnswer") : nullptr;
    CFTypeRef answer = copyAnswer ? copyAnswer(CFSTR("ArtworkDeviceSubType")) : nullptr;
    long subtype     = 0;
    if (answer && CFGetTypeID(answer) == CFNumberGetTypeID())
    {
        CFNumberGetValue((CFNumberRef) answer, kCFNumberLongType, &subtype);
    }

    if (answer)
    {
        CFRelease(answer);
    }

    return subtype;
}

static std::string modelEdit()
{
    std::string machine = machineName();
    long subtype        = artworkSubtype();
    if (!machine.starts_with("iPhone") || !kDynamicIslandSubtypes.contains(subtype))
    {
        return "";
    }

    int major      = std::atoi(machine.c_str() + 6);
    bool hasIsland = major >= 15 && machine != "iPhone14,6";
    return hasIsland ? "" : "Dynamic Island added by a MobileGestalt edit";
}

static std::string jailbreakVersion()
{
    NSString *version = [NSString stringWithContentsOfFile:@"/var/jb/basebin/.version"
                                                  encoding:NSUTF8StringEncoding
                                                     error:nil];
    NSString *trimmed =
        [version stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    bool dopamine = [NSFileManager.defaultManager fileExistsAtPath:@"/var/jb/.installed_dopamine"];
    return dopamine && trimmed.length ? "Dopamine " + toStdString(trimmed) : "";
}

static bool hasSideStoreVPN()
{
    struct ifaddrs *interfaces = nullptr;
    if (getifaddrs(&interfaces) != 0)
    {
        return false;
    }

    bool found = false;
    for (struct ifaddrs *entry = interfaces; entry && !found; entry = entry->ifa_next)
    {
        if (!entry->ifa_addr || entry->ifa_addr->sa_family != AF_INET
            || strncmp(entry->ifa_name, "utun", 4) != 0 || !(entry->ifa_flags & IFF_UP))
        {
            continue;
        }

        char address[INET_ADDRSTRLEN] = {};
        inet_ntop(AF_INET, &((struct sockaddr_in *) entry->ifa_addr)->sin_addr, address,
                  sizeof(address));
        found = [@(address) hasPrefix:kSideStoreVPNPrefix];
    }

    freeifaddrs(interfaces);
    return found;
}

static report::LocaleFacts localeFacts()
{
    report::LocaleFacts facts;
    facts.calendar = toStdString(NSLocale.currentLocale.calendarIdentifier ?: @"");
    NSString *zero = [NSNumberFormatter localizedStringFromNumber:@0
                                                      numberStyle:NSNumberFormatterDecimalStyle];
    facts.nonLatinDigits = zero.length > 0 && ![zero isEqualToString:@"0"];
    NSString *language   = NSLocale.preferredLanguages.firstObject;
    facts.rightToLeft =
        language &&
        [NSLocale characterDirectionForLanguage:language] == NSLocaleLanguageDirectionRightToLeft;
    return facts;
}

static int refreshRate()
{
    static std::atomic_int cached{0};
    if (NSThread.isMainThread)
    {
        cached = (int) UIScreen.mainScreen.maximumFramesPerSecond;
    }
    else if (cached == 0)
    {
        dispatch_async(dispatch_get_main_queue(),
                       ^{ cached = (int) UIScreen.mainScreen.maximumFramesPerSecond; });
    }

    return cached;
}

static bool isiOSAppOnVision()
{
    NSProcessInfo *process = NSProcessInfo.processInfo;
    SEL selector           = NSSelectorFromString(@"isiOSAppOnVision");
    return [process respondsToSelector:selector]
           && ((BOOL (*)(id, SEL)) objc_msgSend)(process, selector);
}

static bool hasPlayTools()
{
    for (uint32_t index = 0; index < _dyld_image_count(); index++)
    {
        const char *name = _dyld_get_image_name(index);
        if (name && std::strstr(name, "/PlayTools.framework/"))
        {
            return YES;
        }
    }

    return NO;
}

static report::AppleDeviceFacts deviceFacts()
{
    report::AppleDeviceFacts facts;
    facts.lockdownMode = [NSUserDefaults.standardUserDefaults boolForKey:@"LDMGlobalEnabled"];
    facts.iPhoneAppOnIPad =
        UIDevice.currentDevice.userInterfaceIdiom == UIUserInterfaceIdiomPad && !supportsIPad();
    facts.iOSAppOnMac      = NSProcessInfo.processInfo.isiOSAppOnMac;
    facts.playCover        = hasPlayTools();
    facts.managedApp       = isManagedApp();
    facts.jitEnabled       = detectedJailbreak().empty() && isJITEnabled();
    facts.debuggerAttached = isDebuggerAttached();
    facts.trollFools       = hasTrollFoolsBackup();
    facts.appSync          = hasAppSyncUnified();
    facts.modelEdit        = modelEdit();
    facts.jailbreakVersion = jailbreakVersion();
    facts.iOSAppOnVision   = isiOSAppOnVision();
    facts.sideStoreVPN     = hasSideStoreVPN();
    facts.liveContainerMultitask =
        [NSBundle.mainBundle.executablePath containsString:@"LiveProcess"];
    facts.refreshRate     = refreshRate();
    facts.boldText        = UIAccessibilityIsBoldTextEnabled();
    facts.locale          = localeFacts();
    const char *duplicate = UnboundDuplicateCopyPath();
    facts.duplicateCopy   = duplicate ? duplicate : "";
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
    if (std::string stack = report::currentNetworkStackMarker(); !stack.empty())
    {
        environment["markers"].push_back(stack);
    }

    NSString *home =
        NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
    if (std::string leftover = report::leftoverModsMarker(home ? home.UTF8String : "");
        !leftover.empty())
    {
        environment["markers"].push_back(leftover);
    }

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
