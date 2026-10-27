#import "Attestation.h"
#import "CoreConversions.h"
#include "LoaderCodeSignature.h"
#include "LoaderEnvironment.h"
#import "Utilities+CodeSignature.h"

using unbound::ios::toStdString;

@implementation Utilities (CodeSignature)

+ (NSDictionary *)getApplicationEntitlements
{
    NSDictionary *signatureInfo = [self getApplicationSignatureInfo];
    return signatureInfo[@"entitlements"] ?: @{};
}

+ (NSDictionary *)getApplicationSignatureInfo
{
    NSBundle *bundle         = [NSBundle mainBundle];
    NSString *executableName = bundle.infoDictionary[@"CFBundleExecutable"];
    if (!executableName)
    {
        return @{};
    }

    NSString *executablePath = [bundle pathForResource:executableName ofType:nil];
    if (!executablePath)
    {
        return @{};
    }

    for (const std::string &blob : loader::codesign::entitlementBlobs(toStdString(executablePath)))
    {
        NSData       *data         = [NSData dataWithBytes:blob.data() length:blob.size()];
        NSError      *error        = nil;
        NSDictionary *entitlements = [NSPropertyListSerialization propertyListWithData:data
                                                                               options:0
                                                                                format:nil
                                                                                 error:&error];
        if (!error && entitlements)
        {
            return @{@"entitlements" : entitlements};
        }
    }

    return @{};
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
    return YES;
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
