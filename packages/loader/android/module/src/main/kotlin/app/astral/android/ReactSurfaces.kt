package app.astral.android

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
    private const val SURFACE_HANDLER = "com.facebook.react.fabric.SurfaceHandlerBinding"
    private const val ARGUMENTS = "com.facebook.react.bridge.Arguments"
    private const val NATIVE_MAP = "com.facebook.react.bridge.NativeMap"
    private const val FUNCTION_2 = "kotlin.jvm.functions.Function2"
    private const val UPDATE_INIT_PROPS = "updateInitProps"

    @Volatile private var reactHost: WeakReference<Any>? = null

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        if (usesLegacyHost(REACT_HOST.find(classLoader))) {
            NativeFabric.useHost(ReflectiveHost(classLoader))
            return
        }
        captureReactHost(xposed, classLoader.loadClass(REACT_HOST_IMPL))
        NativeFabric.useHost(StructuralHost(classLoader))
    }

    internal fun usesLegacyHost(reactHost: Class<*>?): Boolean = reactHost != null &&
        runCatching { reactHost.getMethod("createSurface", Context::class.java, String::class.java, Bundle::class.java) }.isSuccess

    internal class StructuralShapes(
        val surface: Class<*>,
        val handler: Field,
        val references: List<Field>,
        val hostGetter: Method,
        val fabric: Field,
        val delegate: Field,
        val viewFactory: Field,
    )

    internal fun structuralShapes(shapes: DiscordShapes): StructuralShapes = StructuralShapes(
        surface = shapes.shapeClass("reactSurface"),
        handler = shapes.shapeField("reactSurfaceHandler"),
        references = shapes.shapeFields("reactSurfaceReferences"),
        hostGetter = shapes.shapeMethod("reactSurfaceHost"),
        fabric = shapes.shapeField("reactFabric"),
        delegate = shapes.shapeField("reactHostDelegate"),
        viewFactory = shapes.shapeField("reactSurfaceViewFactory"),
    )

    internal class SurfaceReferences(val host: Field, val view: Field)

    internal fun surfaceReferences(surface: Any, references: List<Field>, hostGetter: Method, host: Any): SurfaceReferences {
        val found = references.firstOrNull { reference ->
            @Suppress("UNCHECKED_CAST")
            val candidate = reference.get(surface) as AtomicReference<Any?>
            candidate.set(host)
            val matches = hostGetter.invoke(surface) === host
            candidate.set(null)
            matches
        } ?: throw IllegalStateException("The React surface's host reference could not be identified")
        return SurfaceReferences(found, references.first { it != found })
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
        private val shapes = DiscordShapes.forClassLoader(classLoader)

        override fun createSurface(
            context: Context,
            moduleName: String,
            props: Bundle,
        ): NativeFabric.Surface {
            val host = reactHost?.get() ?: throw IllegalStateException("The React host is unavailable")
            val instance = ReactRuntime.currentInstance() ?: throw IllegalStateException("The React instance is unavailable")
            val structure = structuralShapes(shapes)
            val surface = structure.surface.getConstructor(Context::class.java, String::class.java, Bundle::class.java)
                .newInstance(context, moduleName, props)
            val view = createView(structure, host, context, surface)
            attach(structure, surface, view, host)
            val handler = structure.handler.get(surface)
                ?: throw IllegalStateException("The React surface has no surface handler")
            val fabric = structure.fabric.get(instance)
                ?: throw IllegalStateException("The React instance has no Fabric UI manager")
            return StructuralSurface(view, handler, fabric, classLoader)
        }

        override fun activityContext(): Context? = ActivityTracker.currentActivity()

        private fun createView(structure: StructuralShapes, host: Any, context: Context, surface: Any): View {
            val delegate = structure.delegate.get(host)
                ?: throw IllegalStateException("The React host has no delegate")
            val factory = structure.viewFactory.get(delegate)
                ?: throw IllegalStateException("The React host delegate has no surface view factory")
            val invoke = classLoader.loadClass(FUNCTION_2).getMethod("invoke", Any::class.java, Any::class.java)
            return invoke.invoke(factory, context, surface) as? View
                ?: throw IllegalStateException("The surface view factory did not return a view")
        }

        private fun attach(structure: StructuralShapes, surface: Any, view: View, host: Any) {
            val references = surfaceReferences(surface, structure.references, structure.hostGetter, host)
            @Suppress("UNCHECKED_CAST")
            (references.view.get(surface) as AtomicReference<Any?>).set(view)
            @Suppress("UNCHECKED_CAST")
            (references.host.get(surface) as AtomicReference<Any?>).set(host)
        }
    }
}
