package app.unbound.android

import android.content.Context
import android.os.Bundle
import android.view.View
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import java.lang.ref.WeakReference
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.util.concurrent.atomic.AtomicReference

object ReactSurfaces {
    private val REACT_HOST = HostClass.legacy("com.facebook.react.ReactHost")
    private val REACT_SURFACE = HostClass.legacy("com.facebook.react.interfaces.fabric.ReactSurface")
    private const val REACT_HOST_IMPL = "com.facebook.react.runtime.ReactHostImpl"
    private const val HOST_DELEGATE = "com.facebook.react.defaults.DefaultReactHostDelegate"
    private const val FABRIC_UI_MANAGER = "com.facebook.react.fabric.FabricUIManager"
    private const val SURFACE_HANDLER = "com.facebook.react.fabric.SurfaceHandlerBinding"
    private const val ARGUMENTS = "com.facebook.react.bridge.Arguments"
    private const val NATIVE_MAP = "com.facebook.react.bridge.NativeMap"
    private const val FUNCTION_2 = "kotlin.jvm.functions.Function2"
    private const val UPDATE_INIT_PROPS = "updateInitProps"

    @Volatile private var reactHost: WeakReference<Any>? = null

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        val legacy = runCatching {
            REACT_HOST.load(classLoader).getMethod("createSurface", Context::class.java, String::class.java, Bundle::class.java)
        }.isSuccess
        if (legacy) {
            NativeFabric.useHost(ReflectiveHost(classLoader))
            return
        }
        captureReactHost(xposed, classLoader.loadClass(REACT_HOST_IMPL))
        NativeFabric.useHost(StructuralHost(classLoader))
    }

    private fun captureReactHost(xposed: XposedInterface, hostClass: Class<*>) {
        for (constructor in hostClass.declaredConstructors) {
            xposed.hook(constructor)
                .setExceptionMode(ExceptionMode.PROTECTIVE)
                .intercept { chain ->
                    chain.proceed().also { reactHost = WeakReference(chain.thisObject) }
                }
        }
    }

    private class ReflectiveSurface(private val surface: Any, private val surfaceClass: Class<*>) : NativeFabric.Surface {
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
            val hostClass = REACT_HOST.load(classLoader)
            val surfaceClass = REACT_SURFACE.load(classLoader)
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

    private class StructuralSurface(
        private val view: View,
        private val handler: Any,
        private val fabric: Any,
        private val classLoader: ClassLoader,
    ) : NativeFabric.Surface {
        private val handlerClass = classLoader.loadClass(SURFACE_HANDLER)

        override fun view(): View = view

        override fun start() {
            view.id = View.NO_ID
            fabric.javaClass.getMethod("startSurface", handlerClass, Context::class.java, View::class.java)
                .invoke(fabric, handler, view.context, view)
        }

        override fun stop() {
            fabric.javaClass.getMethod("stopSurface", handlerClass).invoke(fabric, handler)
        }

        override fun updateProps(props: Bundle) {
            val nativeMap = classLoader.loadClass(ARGUMENTS).getMethod("fromBundle", Bundle::class.java).invoke(null, props)
            handlerClass.getMethod("setProps", classLoader.loadClass(NATIVE_MAP)).invoke(handler, nativeMap)
        }

        override fun isRunning(): Boolean = handlerClass.getMethod("isRunning").invoke(handler) as? Boolean ?: false
    }

    private class StructuralHost(private val classLoader: ClassLoader) : NativeFabric.Host {
        override fun createSurface(
            context: Context,
            moduleName: String,
            props: Bundle,
        ): NativeFabric.Surface {
            val host = reactHost?.get() ?: throw IllegalStateException("The React host is unavailable")
            val instance = ReactRuntime.currentInstance() ?: throw IllegalStateException("The React instance is unavailable")
            val surfaceClass = surfaceClass(instance.javaClass)
            val surface = surfaceClass.getConstructor(Context::class.java, String::class.java, Bundle::class.java)
                .newInstance(context, moduleName, props)
            val view = createView(host, context, surface)
            attach(surface, surfaceClass, view, host)
            val handler = fieldOfType(surfaceClass, classLoader.loadClass(SURFACE_HANDLER)).get(surface)
                ?: throw IllegalStateException("The React surface has no surface handler")
            val fabric = fieldOfType(instance.javaClass, classLoader.loadClass(FABRIC_UI_MANAGER)).get(instance)
                ?: throw IllegalStateException("The React instance has no Fabric UI manager")
            return StructuralSurface(view, handler, fabric, classLoader)
        }

        override fun activityContext(): Context? = ActivityTracker.currentActivity()

        private fun surfaceClass(instanceClass: Class<*>): Class<*> =
            instanceClass.declaredMethods
                .mapNotNull { it.parameterTypes.singleOrNull() }
                .firstOrNull { candidate ->
                    runCatching { candidate.getConstructor(Context::class.java, String::class.java, Bundle::class.java) }.isSuccess
                }
                ?: throw IllegalStateException("This React Native build has no surface class the loader recognises")

        private fun createView(host: Any, context: Context, surface: Any): View {
            val delegate = fieldOfType(host.javaClass, classLoader.loadClass(HOST_DELEGATE)).get(host)
                ?: throw IllegalStateException("The React host has no delegate")
            val factoryType = classLoader.loadClass(FUNCTION_2)
            val factory = fieldOfType(delegate.javaClass, factoryType).get(delegate)
                ?: throw IllegalStateException("The React host delegate has no surface view factory")
            val invoke = factoryType.getMethod("invoke", Any::class.java, Any::class.java)
            return invoke.invoke(factory, context, surface) as? View
                ?: throw IllegalStateException("The surface view factory did not return a view")
        }

        private fun attach(surface: Any, surfaceClass: Class<*>, view: View, host: Any) {
            val references = surfaceClass.declaredFields
                .filter { it.type == AtomicReference::class.java }
                .onEach { it.isAccessible = true }
            check(references.size == 2) { "The React surface has ${references.size} attachment references, expected 2" }
            val hostGetter = hostGetter(surfaceClass, host.javaClass)
            val (hostReference, viewReference) = references.firstOrNull { reference ->
                @Suppress("UNCHECKED_CAST")
                val candidate = reference.get(surface) as AtomicReference<Any?>
                candidate.set(host)
                val matches = hostGetter.invoke(surface) === host
                candidate.set(null)
                matches
            }?.let { found -> found to references.first { it != found } }
                ?: throw IllegalStateException("The React surface's host reference could not be identified")
            @Suppress("UNCHECKED_CAST")
            (viewReference.get(surface) as AtomicReference<Any?>).set(view)
            @Suppress("UNCHECKED_CAST")
            (hostReference.get(surface) as AtomicReference<Any?>).set(host)
        }

        private fun hostGetter(surfaceClass: Class<*>, hostClass: Class<*>): Method =
            surfaceClass.declaredMethods.firstOrNull {
                it.parameterTypes.isEmpty() && it.returnType.isAssignableFrom(hostClass) &&
                    it.returnType != Any::class.java
            }
                ?.apply { isAccessible = true }
                ?: throw IllegalStateException("The React surface has no host getter")
    }

    private fun fieldOfType(owner: Class<*>, type: Class<*>): Field =
        generateSequence(owner) { it.superclass }
            .flatMap { it.declaredFields.asSequence() }
            .firstOrNull { type.isAssignableFrom(it.type) }
            ?.apply { isAccessible = true }
            ?: throw IllegalStateException("${owner.name} has no ${type.name} field")
}
