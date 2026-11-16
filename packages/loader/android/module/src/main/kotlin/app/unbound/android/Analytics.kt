package app.unbound.android

import android.content.Context
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode

object Analytics {
    private const val SENTRY_INIT_PROVIDER = "io.sentry.android.core.SentryInitProvider"
    private const val SENTRY_MODULE = "io.sentry.react.RNSentryModuleImpl"
    private const val REACT_MAP = "com.facebook.react.bridge.ReadableMap"
    private const val REACT_PROMISE = "com.facebook.react.bridge.Promise"
    private const val APPSFLYER = "com.appsflyer.AppsFlyerLib"
    private const val APPSFLYER_LISTENER = "com.appsflyer.attribution.AppsFlyerRequestListener"
    private const val APPSFLYER_CONVERSION_LISTENER = "com.appsflyer.AppsFlyerConversionListener"
    private const val ADS_MODULE = "com.discord.ads.AdsModule"
    private const val INSTALL_REFERRER_MODULE = "com.discord.analytics.InstallReferrerModule"
    private const val TOUCH_ANALYTICS_MODULE = "com.discord.analytics.touch.TouchEventAnalyticsModule"

    fun block(xposed: XposedInterface, classLoader: ClassLoader) {
        runCatching { blockInitProvider(xposed, classLoader) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block the Sentry init provider", it) }
        runCatching { blockNativeSdk(xposed, classLoader) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block the Sentry native SDK", it) }
        runCatching { blockAppsFlyer(xposed, classLoader) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block AppsFlyer", it) }
        runCatching { resolveNull(xposed, classLoader, ADS_MODULE, "getGoogleAdvertisingId", "the advertising ID") }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block the advertising ID", it) }
        runCatching { resolveNull(xposed, classLoader, INSTALL_REFERRER_MODULE, "get", "the install referrer") }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block the install referrer", it) }
        runCatching { blockTouchLogging(xposed, classLoader) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block touch analytics", it) }
    }

    // Answers one of Discord's promise-returning native modules with null, the value it resolves when the data is unavailable.
    private fun resolveNull(
        xposed: XposedInterface,
        classLoader: ClassLoader,
        moduleName: String,
        methodName: String,
        what: String,
    ) {
        val promiseClass = classLoader.loadClass(REACT_PROMISE)
        val method = classLoader.loadClass(moduleName).getDeclaredMethod(methodName, promiseClass)
        val resolve = promiseClass.getMethod("resolve", Any::class.java)

        xposed.hook(method)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                Logger.info(LogCategory.DEFAULT, "Blocked $what.")
                resolve.invoke(chain.getArg(0), null)
                null
            }
    }

    private fun blockTouchLogging(xposed: XposedInterface, classLoader: ClassLoader) {
        val module = classLoader.loadClass(TOUCH_ANALYTICS_MODULE)

        xposed.hook(module.getDeclaredMethod("enableTouchLogging"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept {
                Logger.info(LogCategory.DEFAULT, "Blocked touch analytics.")
                null
            }
    }

    private fun blockAppsFlyer(xposed: XposedInterface, classLoader: ClassLoader) {
        val api = classLoader.loadClass(APPSFLYER)
        val implementation = api.getMethod("getInstance").invoke(null)?.javaClass ?: api
        val context = Context::class.java
        val starts = listOf(
            implementation.getMethod("start", context),
            implementation.getMethod("start", context, String::class.java),
            implementation.getMethod("start", context, String::class.java, classLoader.loadClass(APPSFLYER_LISTENER)),
        )
        val init = implementation.getMethod(
            "init",
            String::class.java,
            classLoader.loadClass(APPSFLYER_CONVERSION_LISTENER),
            context,
        )

        for (start in starts) {
            xposed.hook(start)
                .setExceptionMode(ExceptionMode.PROTECTIVE)
                .intercept {
                    Logger.info(LogCategory.DEFAULT, "Blocked AppsFlyer.")
                    null
                }
        }
        xposed.hook(init)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain -> chain.thisObject }
        xposed.hook(implementation.getMethod("isStopped"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { true }
    }

    private fun blockInitProvider(xposed: XposedInterface, classLoader: ClassLoader) {
        val provider = classLoader.loadClass(SENTRY_INIT_PROVIDER)
        xposed.hook(provider.getDeclaredMethod("onCreate"))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept {
                Logger.info(LogCategory.DEFAULT, "Blocked Sentry auto-initialization.")
                true
            }
    }

    private fun blockNativeSdk(xposed: XposedInterface, classLoader: ClassLoader) {
        val module = classLoader.loadClass(SENTRY_MODULE)
        val promiseClass = classLoader.loadClass(REACT_PROMISE)
        val initNativeSdk = module.getDeclaredMethod(
            "initNativeSdk",
            classLoader.loadClass(REACT_MAP),
            promiseClass,
        )
        val resolve = promiseClass.getMethod("resolve", Any::class.java)

        xposed.hook(initNativeSdk)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                Logger.info(LogCategory.DEFAULT, "Blocked Sentry native SDK.")
                resolve.invoke(chain.getArg(1), java.lang.Boolean.FALSE)
                null
            }
    }
}
