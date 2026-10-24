#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

#ifdef __cplusplus
extern "C" {
#endif
// Posted on a background queue once a record is stored; the notification object is the
// EvaluationRecord.
extern NSString *const EvaluationsDidRecordNotification;
#ifdef __cplusplus
}
#endif

// Mirrors the `level` of a debugger-protocol LogMessage.
typedef NS_ENUM(NSInteger, EvaluationLogLevel) {
    EvaluationLogLevelLog   = 1,
    EvaluationLogLevelWarn  = 2,
    EvaluationLogLevelError = 3
};

@interface EvaluationLogLine : NSObject

@property (readonly) EvaluationLogLevel level;
@property (readonly, copy) NSString    *message;

- (instancetype)initWithLevel:(EvaluationLogLevel)level message:(NSString *)message;

@end

@interface EvaluationRecord : NSObject

@property (readonly, copy) NSString                      *identifier;
@property (readonly, copy) NSString                      *code;
@property (readonly) BOOL                                 ok;
@property (readonly, copy, nullable) NSString            *value;
@property (readonly, copy, nullable) NSString            *error;
@property (readonly, copy) NSArray<EvaluationLogLine *> *logs;
@property (readonly, copy) NSDate                        *date;

- (instancetype)initWithIdentifier:(NSString *)identifier
                              code:(NSString *)code
                                ok:(BOOL)ok
                             value:(nullable NSString *)value
                             error:(nullable NSString *)error
                              logs:(NSArray<EvaluationLogLine *> *)logs;

@end

@interface Evaluations : NSObject

// Returns immediately; storing, logging and notifying happen on a serial background queue.
+ (void)record:(EvaluationRecord *)record;

// The most recent records, oldest first.
+ (NSArray<EvaluationRecord *> *)history;

@end

NS_ASSUME_NONNULL_END
