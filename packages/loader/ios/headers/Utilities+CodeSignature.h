#import <Foundation/Foundation.h>

#import "Utilities.h"

@interface Utilities (CodeSignature)

+ (NSDictionary *)getApplicationEntitlements;
+ (NSDictionary *)getApplicationSignatureInfo;
+ (NSString *)formatEntitlementsAsPlist:(NSDictionary *)entitlements;
+ (BOOL)isVerifiedBuild;
+ (BOOL)hasDiscordProductionEntitlements;

@end
