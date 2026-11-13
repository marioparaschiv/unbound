#pragma once

#import <Foundation/Foundation.h>

@interface BackgroundDownloads : NSObject
+ (instancetype)shared;
+ (void)handleAppEvents;
- (void)continueDownload:(NSURL *)url
                      to:(NSString *)destination
                 headers:(NSDictionary<NSString *, NSString *> *)headers;
@end
