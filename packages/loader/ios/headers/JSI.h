#pragma once

#import <Foundation/Foundation.h>
#import <functional>
#import <jsi/jsi.h>
#import <exception>
#import <memory>
#import <string>

#import "Logger.h"
#import "Utilities.h"

@interface JSI : NSObject

+ (facebook::jsi::Value)fromObjC:(id)value runtime:(facebook::jsi::Runtime &)runtime;
+ (NSString *)toNSString:(const facebook::jsi::Value &)value
                 runtime:(facebook::jsi::Runtime &)runtime;
+ (BOOL)toBool:(const facebook::jsi::Value &)value
       runtime:(facebook::jsi::Runtime &)runtime
      fallback:(BOOL)fallback;
+ (double)toNumber:(const facebook::jsi::Value &)value fallback:(double)fallback;

+ (facebook::jsi::Value)makeFunction:(const char *)name
                            argCount:(unsigned int)argCount
                             runtime:(facebook::jsi::Runtime &)runtime
                             handler:(const facebook::jsi::HostFunctionType &)handler;

+ (BOOL)evaluate:(NSData *)scriptData tag:(NSString *)tag runtime:(facebook::jsi::Runtime &)runtime;

+ (facebook::jsi::Value)evaluateSource:(NSString *)source
                                    tag:(NSString *)tag
                                runtime:(facebook::jsi::Runtime &)runtime;

+ (facebook::jsi::Value)evaluateBytecode:(NSData *)bytecodeData
                                      tag:(NSString *)tag
                                  runtime:(facebook::jsi::Runtime &)runtime;

@end
