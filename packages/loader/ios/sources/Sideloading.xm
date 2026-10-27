#import "Sideloading.h"

#import "CoreConversions.h"
#include "LoaderBrowserLogin.h"
#include "LoaderDiagnostics.h"

using unbound::ios::toNSString;
using unbound::ios::toStdString;

namespace browserlogin = loader::browserlogin;

static_assert(browserlogin::kIVBytes == kCCBlockSizeAES128);
static_assert(browserlogin::kMACBytes == CC_SHA256_DIGEST_LENGTH);

static NSString *const BrowserLoginStateKey  = @"BrowserLoginState";
static NSString *const BrowserLoginSecretKey = @"BrowserLoginSecret";
static NSString *const BrowserLoginDateKey   = @"BrowserLoginDate";

static std::string_view bytesOf(NSData *data)
{
    return std::string_view(static_cast<const char *>(data.bytes), data.length);
}

static NSString *browserLoginBase64URL(NSData *data)
{
    return toNSString(browserlogin::base64URLEncode(bytesOf(data)));
}

static NSData *browserLoginDecodeBase64URL(NSString *encoded)
{
    if (encoded.length == 0)
    {
        return nil;
    }

    return [[NSData alloc]
        initWithBase64EncodedString:toNSString(browserlogin::paddedBase64(toStdString(encoded)))
                            options:0];
}

static NSData *browserLoginRandomData(NSUInteger length)
{
    NSMutableData *data = [NSMutableData dataWithLength:length];
    if (SecRandomCopyBytes(kSecRandomDefault, length, data.mutableBytes) != errSecSuccess)
    {
        return nil;
    }
    return data;
}

static NSString *browserLoginQueryValue(NSURLComponents *components, NSString *name)
{
    for (NSURLQueryItem *item in components.queryItems)
    {
        if ([item.name isEqualToString:name])
        {
            return item.value;
        }
    }
    return nil;
}

static void browserLoginClear(void)
{
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    [defaults removeObjectForKey:BrowserLoginStateKey];
    [defaults removeObjectForKey:BrowserLoginSecretKey];
    [defaults removeObjectForKey:BrowserLoginDateKey];
}

static NSString *safariExtensionIdentifier(void)
{
    NSString *extensionsPath =
        [[[NSBundle mainBundle] bundlePath] stringByAppendingPathComponent:@"PlugIns"];
    NSString *extensionPath   = [extensionsPath
        stringByAppendingPathComponent:[@(loader::diagnostics::kSafariExtensionName)
                                           stringByAppendingPathExtension:@"appex"]];
    NSBundle *extensionBundle = [NSBundle bundleWithPath:extensionPath];
    return [extensionBundle objectForInfoDictionaryKey:@"CFBundleIdentifier"];
}

static void browserLoginStartFlow(void)
{
    NSData *stateData = browserLoginRandomData(browserlogin::kStateBytes);
    NSData *secret    = browserLoginRandomData(browserlogin::kSecretBytes);
    if (!stateData || !secret)
    {
        [Utilities alert:@"Discord could not create a secure browser login session."
                   title:@(browserlogin::kStartFailedTitle)];
        return;
    }

    NSString       *state    = browserLoginBase64URL(stateData);
    NSString       *key      = browserLoginBase64URL(secret);
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    [defaults setObject:state forKey:BrowserLoginStateKey];
    [defaults setObject:secret forKey:BrowserLoginSecretKey];
    [defaults setObject:[NSDate date] forKey:BrowserLoginDateKey];

    NSString *urlString = toNSString(browserlogin::loginURL(toStdString(state), toStdString(key)));
    [[UIApplication sharedApplication] openURL:[NSURL URLWithString:urlString]
        options:@{}
        completionHandler:^(BOOL success) {
            if (!success)
            {
                browserLoginClear();
                [Utilities alert:@"Safari could not be opened."
                           title:@(browserlogin::kStartFailedTitle)];
            }
        }];
}

static void browserLoginStart(void)
{
    if (![Utilities hasAppExtension:@(loader::diagnostics::kSafariExtensionName)])
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"Safari extension is missing."];
        [Utilities alert:@"Browser login requires the Safari extension to be enabled."
                   title:@"Safari Extension Required"];
        return;
    }

    if (@available(iOS 26.2, *))
    {
        NSString *identifier = safariExtensionIdentifier();
        if (identifier.length == 0)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"Safari extension bundle identifier is unavailable."];
            [Utilities alert:@"Discord could not identify the Safari extension."
                       title:@"Could Not Check Extension"];
            return;
        }

        [SFSafariExtensionManager
            getStateOfExtensionWithIdentifier:identifier
                            completionHandler:^(SFSafariExtensionState *state, NSError *error) {
                                dispatch_async(dispatch_get_main_queue(), ^{
                                    if (error || !state)
                                    {
                                        [Logger error:LOG_CATEGORY_DEFAULT
                                               format:@"Could not read Safari extension state: %@.",
                                                      error];
                                        [Utilities
                                            alert:@"Discord could not check whether the Safari "
                                                  @"extension is enabled."
                                            title:@"Could Not Check Extension"];
                                        return;
                                    }

                                    if (!state.isEnabled)
                                    {
                                        [Logger info:LOG_CATEGORY_DEFAULT
                                              format:@"Safari extension is disabled."];
                                        [Utilities
                                            alert:@"Enable the Safari extension "
                                                  @"in Settings, then try browser login again."
                                            title:@"Safari Extension Disabled"];
                                        return;
                                    }

                                    browserLoginStartFlow();
                                });
                            }];
        return;
    }

    browserLoginStartFlow();
}

static void browserLoginFail(NSString *message)
{
    browserLoginClear();
    [Utilities alert:message title:@(browserlogin::kFailedTitle)];
}

static BOOL browserLoginHandleURL(NSURL *url)
{
    if (!browserlogin::isCallbackURL(toStdString(url.scheme), toStdString(url.host)))
    {
        return NO;
    }

    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString       *state    = [defaults stringForKey:BrowserLoginStateKey];
    NSData         *secret   = [defaults dataForKey:BrowserLoginSecretKey];
    NSDate         *date     = [defaults objectForKey:BrowserLoginDateKey];

    NSURLComponents *parts = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    NSString        *returnedState = browserLoginQueryValue(parts, @"state");
    NSData          *iv = browserLoginDecodeBase64URL(browserLoginQueryValue(parts, @"iv"));
    NSData *ciphertext  = browserLoginDecodeBase64URL(browserLoginQueryValue(parts, @"ciphertext"));
    NSData *returnedMAC = browserLoginDecodeBase64URL(browserLoginQueryValue(parts, @"mac"));

    browserlogin::Session  session{toStdString(state), secret.length,
                                   date ? std::optional<double>(-date.timeIntervalSinceNow)
                                        : std::nullopt};
    browserlogin::Callback callback{toStdString(returnedState), iv.length, ciphertext.length,
                                    returnedMAC.length};

    switch (browserlogin::checkCallback(session, callback))
    {
        case browserlogin::CallbackCheck::NoSession:
            [Logger info:LOG_CATEGORY_DEFAULT
                  format:@"Ignoring browser login callback without an active session."];
            return YES;
        case browserlogin::CallbackCheck::StateMismatch:
            [Logger info:LOG_CATEGORY_DEFAULT
                  format:@"Ignoring callback with state length %lu; active state length %lu.",
                         (unsigned long) returnedState.length, (unsigned long) state.length];
            return YES;
        case browserlogin::CallbackCheck::Invalid:
            [Logger
                 error:LOG_CATEGORY_DEFAULT
                format:
                    @"Browser login validation failed: session=%d fresh=%d secret=%lu iv=%lu ciphertext=%lu mac=%lu age=%.1f.",
                    secret.length == browserlogin::kSecretBytes &&
                        browserlogin::isFresh(session.ageSeconds),
                    browserlogin::isFresh(session.ageSeconds), (unsigned long) secret.length,
                    (unsigned long) iv.length, (unsigned long) ciphertext.length,
                    (unsigned long) returnedMAC.length, session.ageSeconds.value_or(-1)];
            browserLoginFail(@(browserlogin::kInvalidSessionMessage));
            return YES;
        case browserlogin::CallbackCheck::Valid:
            break;
    }

    std::string authenticatedData =
        browserlogin::authenticatedData(toStdString(state), bytesOf(iv), bytesOf(ciphertext));

    uint8_t expectedMAC[CC_SHA256_DIGEST_LENGTH];
    CCHmac(kCCHmacAlgSHA256, (const uint8_t *) secret.bytes + browserlogin::kKeyBytes,
           browserlogin::kKeyBytes, authenticatedData.data(), authenticatedData.size(),
           expectedMAC);
    if (!browserlogin::constantTimeEqual(
            std::string_view(reinterpret_cast<const char *>(expectedMAC), sizeof(expectedMAC)),
            bytesOf(returnedMAC)))
    {
        [Logger error:LOG_CATEGORY_DEFAULT format:@"Browser login MAC verification failed."];
        browserLoginFail(@(browserlogin::kUnverifiedMessage));
        return YES;
    }

    NSMutableData *plaintext =
        [NSMutableData dataWithLength:ciphertext.length + kCCBlockSizeAES128];
    size_t          plaintextLength = 0;
    CCCryptorStatus status =
        CCCrypt(kCCDecrypt, kCCAlgorithmAES, kCCOptionPKCS7Padding, secret.bytes,
                browserlogin::kKeyBytes, iv.bytes, ciphertext.bytes, ciphertext.length,
                plaintext.mutableBytes, plaintext.length, &plaintextLength);
    if (status != kCCSuccess)
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"Browser login decryption failed with status %d.", status];
        browserLoginFail(@(browserlogin::kUnreadableMessage));
        return YES;
    }

    plaintext.length = plaintextLength;
    NSString *token  = [[NSString alloc] initWithData:plaintext encoding:NSUTF8StringEncoding];
    browserLoginClear();
    if (token.length < browserlogin::kMinimumTokenLength)
    {
        [Logger error:LOG_CATEGORY_DEFAULT
               format:@"Browser login returned a short token (%lu characters).",
                      (unsigned long) token.length];
        [Utilities alert:@(browserlogin::kInvalidTokenMessage) title:@(browserlogin::kFailedTitle)];
        return YES;
    }

    [Logger info:LOG_CATEGORY_DEFAULT format:@"Browser login callback verified."];
    CompleteBrowserLogin(token);
    return YES;
}

static BOOL browserLoginShouldHandleController(ASAuthorizationController *controller)
{
    for (ASAuthorizationRequest *request in controller.authorizationRequests)
    {
        if ([request
                conformsToProtocol:@protocol(ASAuthorizationPublicKeyCredentialAssertionRequest)])
        {
            return YES;
        }
    }
    return NO;
}

static NSError *iconError(NSInteger code, NSString *description)
{
    return [NSError errorWithDomain:@"Icon"
                               code:code
                           userInfo:@{NSLocalizedDescriptionKey : description}];
}

static void completeIconChange(void (^completion)(NSError *error), NSError *error)
{
    if (completion)
    {
        dispatch_async(dispatch_get_main_queue(), ^{ completion(error); });
    }
}

static void setAlternateIconNameWithUIKit(NSString *iconName, void (^completion)(NSError *error),
                                          NSError  *fallbackError)
{
    UIApplication *application = UIApplication.sharedApplication;
    SEL setterSelector         = NSSelectorFromString(@"_setAlternateIconName:completionHandler:");
    if (![application respondsToSelector:setterSelector])
    {
        completeIconChange(completion, fallbackError);
        return;
    }

    typedef void (*IconSetter)(id, SEL, NSString *, void (^)(NSError *error));
    IconSetter setIcon = (IconSetter) objc_msgSend;
    setIcon(application, setterSelector, iconName, ^(NSError *error) {
        [Logger info:LOG_CATEGORY_DEFAULT
              format:@"UIKit private icon result: icon=%@ error=%@.", iconName ?: @"<primary>",
                     error];
        completeIconChange(completion, error ?: fallbackError);
    });
}

void SetAlternateIconName(NSString *iconName, void (^completion)(NSError *error))
{
    Class bundleProxyClass = NSClassFromString(@"LSBundleProxy");
    SEL   proxySelector    = NSSelectorFromString(@"bundleProxyForCurrentProcess");
    if (!bundleProxyClass || ![bundleProxyClass respondsToSelector:proxySelector])
    {
        NSError *error = iconError(1, @"LSBundleProxy is unavailable");
        [Logger error:LOG_CATEGORY_DEFAULT format:@"LSBundleProxy unavailable."];
        setAlternateIconNameWithUIKit(iconName, completion, error);
        return;
    }

    id (*getBundleProxy)(id, SEL) = (id (*)(id, SEL)) objc_msgSend;
    id  bundleProxy               = getBundleProxy(bundleProxyClass, proxySelector);
    SEL setterSelector            = NSSelectorFromString(@"setAlternateIconName:withResult:");
    if (!bundleProxy || ![bundleProxy respondsToSelector:setterSelector])
    {
        NSError *error = iconError(2, @"LSApplicationProxy icon setter is unavailable");
        [Logger error:LOG_CATEGORY_DEFAULT format:@"LSApplicationProxy icon setter unavailable."];
        setAlternateIconNameWithUIKit(iconName, completion, error);
        return;
    }

    typedef void (*IconSetter)(id, SEL, NSString *, void (^)(BOOL success, NSError *error));
    IconSetter setIcon = (IconSetter) objc_msgSend;
    setIcon(bundleProxy, setterSelector, iconName, ^(BOOL success, NSError *error) {
        [Logger info:LOG_CATEGORY_DEFAULT
              format:@"LSApplicationProxy icon result: success=%d icon=%@ error=%@.", success,
                     iconName ?: @"<primary>", error];
        if (success && !error)
        {
            completeIconChange(completion, nil);
            return;
        }

        NSError *fallbackError =
            error ?: iconError(3, @"LSApplicationProxy rejected the icon change");
        setAlternateIconNameWithUIKit(iconName, completion, fallbackError);
    });
}

%hook NSFileManager
- (NSURL *)containerURLForSecurityApplicationGroupIdentifier:(NSString *)identifier
{
    if (identifier != nil)
    {
        NSError *error;

        NSFileManager *manager = [NSFileManager defaultManager];
        NSURL         *url     = [manager URLForDirectory:NSDocumentDirectory
                                                 inDomain:NSUserDomainMask
                                        appropriateForURL:nil
                                                   create:YES
                                                    error:&error];

        if (error)
        {
            [Logger error:LOG_CATEGORY_DEFAULT
                   format:@"Failed getting documents directory: %@", error];
            return %orig(identifier);
        }

        return url;
    }

    return %orig(identifier);
}
%end

%hook UIDocumentPickerViewController

- (instancetype)initForOpeningContentTypes:(NSArray<UTType *> *)contentTypes asCopy:(BOOL)asCopy
{
    BOOL shouldMultiselect = NO;
    if ([contentTypes count] == 1 && contentTypes[0] == UTTypeFolder)
    {
        shouldMultiselect = YES;
    }

    NSArray<UTType *> *contentTypesNew = @[ UTTypeItem, UTTypeFolder ];

    UIDocumentPickerViewController *ans = %orig(contentTypesNew, YES);
    if (shouldMultiselect)
    {
        [ans setAllowsMultipleSelection:YES];
    }
    return ans;
}

- (instancetype)initWithDocumentTypes:(NSArray<UTType *> *)contentTypes inMode:(NSUInteger)mode
{
    return [self initForOpeningContentTypes:contentTypes asCopy:(mode == 1 ? NO : YES)];
}

- (void)setAllowsMultipleSelection:(BOOL)allowsMultipleSelection
{
    if ([self allowsMultipleSelection])
    {
        return;
    }
    %orig(YES);
}

%end

%hook UIDocumentBrowserViewController

- (instancetype)initForOpeningContentTypes:(NSArray<UTType *> *)contentTypes
{
    NSArray<UTType *> *contentTypesNew = @[ UTTypeItem, UTTypeFolder ];
    return %orig(contentTypesNew);
}

%end

%hook NSURL

- (BOOL)startAccessingSecurityScopedResource
{
    %orig;
    return YES;
}

%end

%hook UIApplication
- (void)setAlternateIconName:(NSString *)iconName completionHandler:(void (^)(NSError *))completion
{
    void (^wrappedCompletion)(NSError *) = ^(NSError *error) {
        if (completion)
        {
            completion(error);
        }
    };

    SetAlternateIconName(iconName, wrappedCompletion);
}
%end

%hook ASAuthorizationController

- (void)performRequests
{
    if (browserLoginShouldHandleController(self))
    {
        browserLoginStart();
        return;
    }
    %orig;
}

- (void)performRequestsWithOptions:(NSUInteger)options
{
    if (browserLoginShouldHandleController(self))
    {
        browserLoginStart();
        return;
    }
    %orig(options);
}

%end

%hook RCTLinkingManager

+ (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
    if (browserLoginHandleURL(url))
    {
        return YES;
    }
    return %orig(application, url, options);
}

%end

%ctor
{
    if (![Utilities hasDiscordProductionEntitlements])
    {
        %init();
    }
}
