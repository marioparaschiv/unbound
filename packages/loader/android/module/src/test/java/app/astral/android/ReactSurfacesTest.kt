package app.astral.android

import android.content.Context
import android.os.Bundle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicReference

class SurfaceHandlerStub

class FabricUIManagerStub

interface ReactHost350 {
    fun createSurface(context: Context, moduleName: String, props: Bundle): Any?
}

interface ReactHostDelegate350

class ReactHostImpl350 : ReactHost350 {
    private val reactHostDelegate: ReactHostDelegate350? = null

    override fun createSurface(context: Context, moduleName: String, props: Bundle): Any? = reactHostDelegate
}

class DefaultReactHostDelegate350 : ReactHostDelegate350 {
    private val createReactSurfaceViewCallback: ((Any?, Any?) -> Any?)? = null
    private val exceptionHandler: ((Any?) -> Unit)? = null
    private val jsMainModulePath: String = ""
}

@Suppress("UNUSED_PARAMETER")
class ReactSurfaceImpl350(context: Context?, moduleName: String, props: Bundle?) {
    private val surfaceHandler: SurfaceHandlerStub? = null
    private val reactHostRef = AtomicReference<Any?>()
    private val surfaceViewRef = AtomicReference<Any?>()

    fun getReactHost(): ReactHostImpl350? = reactHostRef.get() as ReactHostImpl350?

    fun getModuleName(): String = ""

    fun getContext(): Context? = null
}

@Suppress("UNUSED_PARAMETER")
class ReactInstance350 {
    private val fabricUIManager = FabricUIManagerStub()

    fun prerenderSurface(surface: ReactSurfaceImpl350) = Unit

    fun startSurface(surface: ReactSurfaceImpl350) = Unit

    fun stopSurface(surface: ReactSurfaceImpl350) = Unit

    fun getNativeModule(name: String): Any? = null
}

class ViewFactory352 : (Any?, Any?) -> Any? {
    override fun invoke(context: Any?, surface: Any?): Any? = surface
}

class Delegate352 {
    private val d: ((Any?) -> Unit)? = null
    private val e: Runnable? = null
    private val f: ViewFactory352? = null
}

class Host352 {
    private val a: Context? = null
    private val b: Delegate352? = null
    private val l = AtomicReference<Any?>()
}

@Suppress("UNUSED_PARAMETER")
class Surface352(context: Context?, moduleName: String, props: Bundle?) {
    private val a: SurfaceHandlerStub? = null
    private val b: Context? = context
    private val c = AtomicReference<Any?>()
    private val d = AtomicReference<Any?>()

    fun a(): Host352? = d.get() as Host352?

    fun b(left: Int, top: Int, right: Int, bottom: Int) = Unit
}

@Suppress("UNUSED_PARAMETER")
class Instance352 {
    private val f = FabricUIManagerStub()

    fun d(name: String): Any? = null

    fun g(surface: Surface352) = Unit
}

@Suppress("UNUSED_PARAMETER")
class InstanceWithoutSurfaces {
    private val f = FabricUIManagerStub()

    fun d(name: String): Any? = null
}

class DelegateWithTwoFactories {
    private val e: ViewFactory352? = null
    private val f: ((Any?, Any?) -> Any?)? = null
}

class SurfaceWithoutHostGetter(
    @Suppress("UNUSED_PARAMETER") context: Context?,
    @Suppress("UNUSED_PARAMETER") moduleName: String,
    @Suppress("UNUSED_PARAMETER") props: Bundle?,
) {
    private val a: SurfaceHandlerStub? = null
    private val c = AtomicReference<Any?>()
    private val d = AtomicReference<Any?>()

    fun a(): Host352? = null
}

fun discordClasses(vararg classes: Pair<String, Class<*>>): (String) -> Class<*>? {
    val named = classes.toMap()
    return { name -> named[name] ?: runCatching { Class.forName(name) }.getOrNull() }
}

class ReactSurfacesTest {
    private val discord350 = DiscordShapes(
        DISCORD_SHAPE_RULES,
        discordClasses(
            "com.facebook.react.runtime.ReactInstance" to ReactInstance350::class.java,
            "com.facebook.react.runtime.ReactHostImpl" to ReactHostImpl350::class.java,
            "com.facebook.react.defaults.DefaultReactHostDelegate" to DefaultReactHostDelegate350::class.java,
            "com.facebook.react.fabric.SurfaceHandlerBinding" to SurfaceHandlerStub::class.java,
            "com.facebook.react.fabric.FabricUIManager" to FabricUIManagerStub::class.java,
        ),
    )

    private fun discord352(
        instance: Class<*> = Instance352::class.java,
        delegate: Class<*> = Delegate352::class.java,
    ) = DiscordShapes(
        DISCORD_SHAPE_RULES,
        discordClasses(
            "com.facebook.react.runtime.ReactInstance" to instance,
            "com.facebook.react.runtime.ReactHostImpl" to Host352::class.java,
            "com.facebook.react.defaults.DefaultReactHostDelegate" to delegate,
            "com.facebook.react.fabric.SurfaceHandlerBinding" to SurfaceHandlerStub::class.java,
            "com.facebook.react.fabric.FabricUIManager" to FabricUIManagerStub::class.java,
        ),
    )

    @Test
    fun usesTheLegacyHostOnlyWhileItCreatesSurfaces() {
        assertTrue(ReactSurfaces.usesLegacyHost(ReactHost350::class.java))
        assertFalse(ReactSurfaces.usesLegacyHost(null))
        assertFalse(ReactSurfaces.usesLegacyHost(ReactHostDelegate350::class.java))
    }

    @Test
    fun findsEveryStructuralPieceInObfuscatedDiscord() {
        val shapes = ReactSurfaces.structuralShapes(discord352())

        assertEquals(Surface352::class.java, shapes.surface)
        assertEquals("a", shapes.handler.name)
        assertEquals(listOf("c", "d"), shapes.references.map { it.name }.sorted())
        assertEquals("a", shapes.hostGetter.name)
        assertEquals("f", shapes.fabric.name)
        assertEquals("b", shapes.delegate.name)
        assertEquals("f", shapes.viewFactory.name)
    }

    @Test
    fun findsTheSameSurfacePiecesInNamedDiscord() {
        assertEquals(ReactSurfaceImpl350::class.java, discord350.shapeClass("reactSurface"))
        assertEquals("surfaceHandler", discord350.shapeField("reactSurfaceHandler").name)
        assertEquals(listOf("reactHostRef", "surfaceViewRef"), discord350.shapeFields("reactSurfaceReferences").map { it.name }.sorted())
        assertEquals("getReactHost", discord350.shapeMethod("reactSurfaceHost").name)
        assertEquals("fabricUIManager", discord350.shapeField("reactFabric").name)
        assertEquals("createReactSurfaceViewCallback", discord350.shapeField("reactSurfaceViewFactory").name)
    }

    @Test
    fun namedDiscordHasNoStructuralDelegateBecauseItUsesTheLegacyHost() {
        val failure = assertThrows(IllegalStateException::class.java) { ReactSurfaces.structuralShapes(discord350) }

        assertTrue(failure.message!!.contains("reactHostDelegate"))
    }

    @Test
    fun failsClearlyWhenNoSurfaceClassMatches() {
        val failure = assertThrows(IllegalStateException::class.java) {
            ReactSurfaces.structuralShapes(discord352(instance = InstanceWithoutSurfaces::class.java))
        }

        assertTrue(failure.message!!.contains("reactSurface"))
    }

    @Test
    fun refusesAnAmbiguousViewFactory() {
        val failure = assertThrows(IllegalStateException::class.java) {
            discord352(delegate = DelegateWithTwoFactories::class.java).shapeField("reactSurfaceViewFactory")
        }

        assertTrue(failure.message!!.contains("ambiguous"))
    }

    @Test
    fun identifiesTheHostReferenceByProbingTheGetter() {
        val shapes = ReactSurfaces.structuralShapes(discord352())
        val surface = Surface352(null, "Surface", null)

        val references = ReactSurfaces.surfaceReferences(surface, shapes.references, shapes.hostGetter, Host352())

        assertEquals("d", references.host.name)
        assertEquals("c", references.view.name)
        assertNull((references.host.get(surface) as AtomicReference<*>).get())
    }

    @Test
    fun identifiesTheHostReferenceInNamedDiscord() {
        val surface = ReactSurfaceImpl350(null, "Surface", null)
        val references = ReactSurfaces.surfaceReferences(
            surface,
            discord350.shapeFields("reactSurfaceReferences"),
            discord350.shapeMethod("reactSurfaceHost"),
            ReactHostImpl350(),
        )

        assertEquals("reactHostRef", references.host.name)
        assertEquals("surfaceViewRef", references.view.name)
    }

    @Test
    fun failsClearlyWhenTheGetterReadsNeitherReference() {
        val type = SurfaceWithoutHostGetter::class.java
        val references = type.declaredFields.filter { it.type == AtomicReference::class.java }.onEach { it.isAccessible = true }

        val failure = assertThrows(IllegalStateException::class.java) {
            ReactSurfaces.surfaceReferences(SurfaceWithoutHostGetter(null, "Surface", null), references, type.getMethod("a"), Host352())
        }

        assertTrue(failure.message!!.contains("host reference"))
    }
}
