package app.fixup.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.Keep
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var isRequestingPermission = false

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        isRequestingPermission = false
        val granted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        pendingGeoCallback?.invoke(pendingGeoOrigin, granted, false)
        pendingGeoOrigin = null
        pendingGeoCallback = null
    }

    inner class AndroidBridge {
        @Keep
        @JavascriptInterface
        fun setTheme(theme: String) {
            runOnUiThread {
                val dark = theme == "dark"
                window.statusBarColor = Color.parseColor(if (dark) "#0B0B1E" else "#0404E2")
                window.navigationBarColor = Color.parseColor(if (dark) "#15152F" else "#FFFFFF")
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.isAppearanceLightStatusBars = false
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    controller.isAppearanceLightNavigationBars = !dark
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#6870FB"))
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
        }

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString FixUpAndroid/2.2.0"
        }

        webView.addJavascriptInterface(AndroidBridge(), "FixUpAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url
                if (url.host == APP_HOST) {
                    return assetLoader.shouldInterceptRequest(url)
                }
                if (url.host == VENDOR_HOST) {
                    val entry = LOCAL_VENDOR_ASSETS[url.path]
                    if (entry != null) {
                        return try {
                            WebResourceResponse(
                                entry.second,
                                "UTF-8",
                                assets.open(entry.first)
                            ).apply {
                                responseHeaders = mapOf("Access-Control-Allow-Origin" to "*")
                            }
                        } catch (_: Exception) {
                            null
                        }
                    }
                }
                return null
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                if (uri.host == APP_HOST) return false
                openExternalUri(uri)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }
                pendingGeoCallback?.invoke(pendingGeoOrigin, false, false)
                pendingGeoOrigin = origin
                pendingGeoCallback = callback
                isRequestingPermission = true
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }

        setContentView(webView)
        setupBackNavigation()
        webView.loadUrl(APP_START_URL)
    }

    override fun onRestart() {
        super.onRestart()
        if (isRequestingPermission) {
            isRequestingPermission = false
            return
        }
        webView.evaluateJavascript(REOPEN_SPLASH_JS, null)
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(BACK_HANDLER_JS) { raw ->
                    if (raw != "\"handled\"") {
                        finish()
                    }
                }
            }
        })
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun openExternalUri(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            // Nenhum navegador ou app disponível para abrir o link externo.
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        pendingGeoCallback?.invoke(pendingGeoOrigin, false, false)
        pendingGeoCallback = null
        pendingGeoOrigin = null
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val VENDOR_HOST = "unpkg.com"
        private const val APP_START_URL = "https://$APP_HOST/assets/index.html"

        private val LOCAL_VENDOR_ASSETS = mapOf(
            "/leaflet@1.9.4/dist/leaflet.css" to ("vendor/leaflet.css" to "text/css"),
            "/leaflet@1.9.4/dist/leaflet.js" to ("vendor/leaflet.js" to "application/javascript"),
            "/lucide@0.469.0/dist/umd/lucide.min.js" to ("vendor/lucide.min.js" to "application/javascript")
        )

        private const val REOPEN_SPLASH_JS =
            "window.FixUp && FixUp.actions && FixUp.actions['rever-abertura'] && FixUp.actions['rever-abertura']();"

        private const val BACK_HANDLER_JS = """
            (function () {
              var fx = window.FixUp;
              if (!fx) return 'exit';
              if (fx.ui && fx.ui.sheet && fx.ui.sheet.isOpen()) {
                fx.ui.sheet.close();
                return 'handled';
              }
              var cur = fx.app && fx.app.current ? fx.app.current() : null;
              var name = cur && cur.name;
              if (name && name !== 'home' && name !== 'proHome') {
                fx.app.back();
                return 'handled';
              }
              return 'exit';
            })()
        """
    }
}
