// Shared between the inspector's sources; nothing here is exported from the dylib.
#pragma once

#import <Foundation/Foundation.h>
#import <objc/runtime.h>

/** Longest string a result carries, in characters. */
#define UB_TEXT_LIMIT 500
/** Most classes a described chain holds. */
#define UB_CHAIN_LIMIT 64
/** Most members, images or classes one page holds, and the page size when the caller passes 0. */
#define UB_PAGE_LIMIT   200
#define UB_PAGE_DEFAULT 100
/** Most values one read returns. */
#define UB_VALUES_LIMIT 50

/** How a member's value is read: from memory without running code, by running its getter, or not at
 * all. */
extern NSString *const UBReadAuto;
extern NSString *const UBReadManual;
extern NSString *const UBReadNever;

/** `text` cut to `UB_TEXT_LIMIT` characters, or `@""` for nil. */
NSString *UBTruncate(NSString *text);

/** `{ error }` for an exception a function caught. */
NSDictionary *UBErrorFromException(NSString *operation, NSException *exception);

/** `{ total, <key>: page }` of the items whose name contains `filter`, case-insensitively. */
NSDictionary *UBPage(NSArray *items, NSString *key, NSUInteger offset, NSUInteger limit,
                     NSString *filter, NSString * (^nameOf)(id item));

/** Whether `kind` is one of the member kinds `listMembers` takes. */
BOOL UBIsMemberKind(NSString *kind);

/**
 * One page of a class's own members of one kind as `{ total, members }`. Names are sorted and
 * cached per class and kind; each member is built the first time a page shows it.
 */
NSDictionary *UBListMemberPage(Class cls, NSString *kind, NSUInteger offset, NSUInteger limit,
                               NSString *filter);

/** How many own members of one kind a class declares, without building them. */
NSUInteger UBMemberCount(Class cls, NSString *kind);

/** Whether a property's or ivar's value is read automatically, through its getter, or never. */
NSString *UBPropertyRead(Class cls, objc_property_t property, BOOL classProperty);
NSString *UBIvarRead(Class cls, Ivar ivar);

/** Whether the ARC weak-ivar layout of `cls`, the class that declares `ivar`, marks it weak. */
BOOL UBIvarIsWeak(Class cls, Ivar ivar);

/** Whether reflecting on instances of `cls` is safe: FLEX's unsafe list, plus Swift roots FLEX
 * rejects. */
BOOL UBClassIsSafe(Class cls);

/** Whether `pointer` is a live Objective-C object (heap or static) whose class can be read. */
BOOL UBPointerIsObject(const void *pointer);

/** Moves a getter batch left over by a crash onto the deny list; runs once when the API is first
 * fetched. */
void UBRecoverCrashedGetters(void);

/** Whether a getter of this member crashed Discord in an earlier run. */
BOOL UBMemberDenied(Class cls, NSString *kind, NSString *name);

/** Records the getters about to run so a crash denies them next launch; `UBEndGetters` clears the
 * record. */
void UBBeginGetters(Class cls, NSString *kind, NSArray<NSString *> *names);
void UBEndGetters(void);

/** Reads named properties or ivars of `object` as `{ values }`; see `UBInspectorAPI.readValues`. */
NSDictionary *UBReadValues(id object, Class cls, NSString *kind, NSArray<NSString *> *names,
                           BOOL invokeGetters);
