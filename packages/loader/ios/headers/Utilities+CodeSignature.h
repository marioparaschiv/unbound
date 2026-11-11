#import <Foundation/Foundation.h>

#import "Utilities.h"

@interface Utilities (CodeSignature)

+ (NSDictionary *)getApplicationEntitlements;
+ (NSDictionary *)getApplicationSignatureInfo;
+ (NSString *)getInstallDetails;
+ (NSString *)formatEntitlementsAsPlist:(NSDictionary *)entitlements;
+ (BOOL)isVerifiedBuild;
+ (BOOL)hasDiscordProductionEntitlements;

@end
