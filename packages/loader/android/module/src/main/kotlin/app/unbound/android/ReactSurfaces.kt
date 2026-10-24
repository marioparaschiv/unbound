package app.unbound.android

import android.content.Context
import android.os.Bundle
import android.view.View

object ReactSurfaces {
    private const val REACT_HOST = "com.facebook.react.ReactHost"
    private const val REACT_SURFACE = "com.facebook.react.interfaces.fabric.ReactSurface"
    private const val UPDATE_INIT_PROPS = "updateInitProps"

    fun install(classLoader: ClassLoader) {
        NativeFabric.useHost(ReflectiveHost(classLoader))
    }

    private class ReflectiveSurface(
        private val surface: Any,
        private val surfaceClass: Class<*>,
    ) : NativeFabric.Surface {
        override fun view(): View =
            surfaceClass.getMethod("getView").invoke(surface) as? View
                ?: throw IllegalStateException("The React surface has no view")

        override fun start() {
            surfaceClass.getMethod("start").invoke(surface)
        }

        override fun stop() {
            surfaceClass.getMethod("stop").invoke(surface)
        }

        override fun updateProps(props: Bundle) {
            val method = runCatching {
                surface.javaClass.getMethod(UPDATE_INIT_PROPS, Bundle::class.java)
            }.getOrNull() ?: throw IllegalStateException(
                "This React Native build cannot update surface props",
            )
            method.isAccessible = true
            method.invoke(surface, props)
        }

        override fun isRunning(): Boolean =
            surfaceClass.getMethod("isRunning").invoke(surface) as? Boolean ?: false
    }

    private class ReflectiveHost(private val classLoader: ClassLoader) : NativeFabric.Host {
        override fun createSurface(
            context: Context,
            moduleName: String,
            props: Bundle,
        ): NativeFabric.Surface {
            val application = Platform.application()
                ?: throw IllegalStateException("The Android application is unavailable")
            val hostClass = classLoader.loadClass(REACT_HOST)
            val surfaceClass = classLoader.loadClass(REACT_SURFACE)
            val reactHost = application.javaClass.getMethod("getReactHost").invoke(application)
                ?: throw IllegalStateException("The React host is unavailable")
            val create = hostClass.getMethod(
                "createSurface",
                Context::class.java,
                String::class.java,
                Bundle::class.java,
            )
            val surface = create.invoke(reactHost, context, moduleName, props)
                ?: throw IllegalStateException("Creating the React surface returned nothing")

            return ReflectiveSurface(surface, surfaceClass)
        }

        override fun activityContext(): Context? = ActivityTracker.currentActivity()
    }
}
