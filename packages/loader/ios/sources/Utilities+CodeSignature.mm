#include <errno.h>
#include <mach-o/dyld.h>
#include <optional>

#import "Attestation.h"
#import "CoreConversions.h"
#include "LoaderCodeSignature.h"
#include "LoaderEnvironment.h"
#import "Utilities+CodeSignature.h"

using unbound::ios::toStdString;

static constexpr unsigned int kCodeSigningOpsEntitlementsBlob = 7;

static std::string kernelEntitlementsBlob()
{
    std::string header(8, '\0');
    if (csops(getpid(), kCodeSigningOpsEntitlementsBlob, header.data(), header.size()) == 0)
    {
        return header;
    }
    if (errno != ERANGE)
    {
        return "";
    }
    const auto  *bytes  = reinterpret_cast<const uint8_t *>(header.data());
    const size_t length = (size_t(bytes[4]) << 24) | (size_t(bytes[5]) << 16) |
                          (size_t(bytes[6]) << 8) | size_t(bytes[7]);
    if (length <= header.size() || length > 1024 * 1024)
    {
        return "";
    }
    std::string blob(length, '\0');
    if (csops(getpid(), kCodeSigningOpsEntitlementsBlob, blob.data(), blob.size()) != 0)
    {
        return "";
    }
    return blob;
}

static NSDictionary *entitlementsPlist(const std::optional<std::string> &plist)
{
    if (!plist || plist->empty())
    {
        return nil;
    }
    NSData       *data         = [NSData dataWithBytes:plist->data() length:plist->size()];
    NSError      *error        = nil;
    NSDictionary *entitlements = [NSPropertyListSerialization propertyListWithData:data
                                                                           options:0
                                                                            format:nil
                                                                             error:&error];
    if (error || ![entitlements isKindOfClass:[NSDictionary class]] || entitlements.count == 0)
    {
        return nil;
    }
    return entitlements;
}

static NSDictionary *kernelEntitlements()
{
    const std::string kernelBlob = kernelEntitlementsBlob();
    return entitlementsPlist(loader::codesign::entitlementsFromBlob(kernelBlob));
}

@implementation Utilities (CodeSignature)

+ (NSDictionary *)getApplicationEntitlements
{
    NSDictionary *signatureInfo = [self getApplicationSignatureInfo];
    return signatureInfo[@"entitlements"] ?: @{};
}

+ (NSDictionary *)getApplicationSignatureInfo
{
    if (NSDictionary *entitlements = kernelEntitlements())
    {
        return @{@"entitlements" : entitlements, @"source" : @"kernel"};
    }

    std::vector<std::string> candidates;
    char                     path[PATH_MAX];
    uint32_t                 size = sizeof(path);
    if (_NSGetExecutablePath(path, &size) == 0)
    {
        candidates.emplace_back(path);
    }
    NSBundle *bundle         = [NSBundle mainBundle];
    NSString *executableName = bundle.infoDictionary[@"CFBundleExecutable"];
    if (NSString *bundleExecutable =
            executableName ? [bundle pathForResource:executableName ofType:nil] : nil)
    {
        candidates.push_back(toStdString(bundleExecutable));
    }

    for (const std::string &candidate : candidates)
    {
        for (const std::string &blob : loader::codesign::entitlementBlobs(candidate))
        {
            if (NSDictionary *entitlements = entitlementsPlist(std::optional<std::string>(blob)))
            {
                return @{@"entitlements" : entitlements, @"source" : @(candidate.c_str())};
            }
        }
    }

    [Logger error:LOG_CATEGORY_UTILITIES
           format:@"No entitlements found in the kernel or in %lu executable(s)",
                  (unsigned long) candidates.size()];
    return @{};
}

+ (NSString *)getInstallDetails
{
    NSDictionary *signature    = [self getApplicationSignatureInfo];
    NSDictionary *entitlements = signature[@"entitlements"];
    NSString     *source       = signature[@"source"];

    loader::environment::SigningFacts facts;
    id                                team = entitlements[@"com.apple.developer.team-identifier"];
    if ([team isKindOfClass:[NSString class]])
    {
        facts.teamIdentifier = toStdString((NSString *) team);
    }
    facts.getTaskAllow = [entitlements[@"get-task-allow"] isKindOfClass:[NSNumber class]] &&
                         [entitlements[@"get-task-allow"] boolValue];
    if (source.length > 0)
    {
        facts.entitlementSource = [source isEqualToString:@"kernel"] ? "kernel" : "executable";
    }

    NSBundle *bundle      = NSBundle.mainBundle;
    NSString *profilePath = [bundle pathForResource:@"embedded" ofType:@"mobileprovision"];
    NSData   *profileData = profilePath ? [NSData dataWithContentsOfFile:profilePath] : nil;
    if (profileData)
    {
        std::string raw(static_cast<const char *>(profileData.bytes), profileData.length);
        if (auto plist = loader::environment::provisioningProfilePlist(raw))
        {
            NSData       *xml     = [NSData dataWithBytes:plist->data() length:plist->size()];
            NSDictionary *profile = [NSPropertyListSerialization propertyListWithData:xml
                                                                              options:0
                                                                               format:nil
                                                                                error:nil];
            if ([profile isKindOfClass:[NSDictionary class]])
            {
                facts.hasProfile           = true;
                facts.provisionsAllDevices = [profile[@"ProvisionsAllDevices"] boolValue];
                id devices                 = profile[@"ProvisionedDevices"];
                facts.listsDevices = [devices isKindOfClass:[NSArray class]] && [devices count] > 0;
                if ([profile[@"ExpirationDate"] isKindOfClass:[NSDate class]])
                {
                    NSISO8601DateFormatter *formatter = [NSISO8601DateFormatter new];
                    formatter.formatOptions           = NSISO8601DateFormatWithFullDate;
                    facts.profileExpiry =
                        toStdString([formatter stringFromDate:profile[@"ExpirationDate"]]);
                }
            }
        }
    }
    facts.altStore = [bundle objectForInfoDictionaryKey:@"ALTDeviceID"] != nil;

    return [NSString stringWithUTF8String:loader::environment::signingDetails(facts).c_str()];
}

+ (NSString *)formatEntitlementsAsPlist:(NSDictionary *)entitlements
{
    if (!entitlements || entitlements.count == 0)
    {
        return nil;
    }

    NSError *error = nil;
    NSData  *plistData =
        [NSPropertyListSerialization dataWithPropertyList:entitlements
                                                   format:NSPropertyListXMLFormat_v1_0
                                                  options:0
                                                    error:&error];

    if (error || !plistData)
    {
        return nil;
    }

    NSString *plistString = [[NSString alloc] initWithData:plistData encoding:NSUTF8StringEncoding];
    return plistString;
}

+ (BOOL)isVerifiedBuild
{
#if ATTESTATION_ENABLED
    return VerifyEmbeddedAttestation() ? YES : NO;
#else
    return NO;
#endif
}

+ (BOOL)hasDiscordProductionEntitlements
{
    NSDictionary *entitlements = [self getApplicationEntitlements];

    NSString *teamIdentifier = entitlements[@"com.apple.developer.team-identifier"];

    BOOL hasProductionEntitlements = loader::environment::isDiscordProductionTeam(
        [teamIdentifier isKindOfClass:[NSString class]]
            ? std::optional<std::string>(toStdString(teamIdentifier))
            : std::nullopt);

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"Team identifier: %@, has production entitlements: %@",
                  teamIdentifier ?: @"(none)", hasProductionEntitlements ? @"YES" : @"NO"];

    return hasProductionEntitlements;
}

@end
