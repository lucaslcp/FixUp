package app.fixup.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintManager
import android.provider.MediaStore
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
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
import androidx.core.content.FileProvider
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraFile: File? = null
    private var pendingCameraUri: Uri? = null
    private var suppressNextSplash = false

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        suppressNextSplash = false
        val granted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        pendingGeoCallback?.invoke(pendingGeoOrigin, granted, false)
        pendingGeoOrigin = null
        pendingGeoCallback = null
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        suppressNextSplash = false
        val callback = pendingFileCallback
        val cameraUri = pendingCameraUri
        val cameraFile = pendingCameraFile
        pendingFileCallback = null
        pendingCameraUri = null
        pendingCameraFile = null

        if (callback == null) return@registerForActivityResult

        if (result.resultCode != RESULT_OK) {
            callback.onReceiveValue(null)
            return@registerForActivityResult
        }

        val uris = mutableListOf<Uri>()
        val data = result.data
        val clip = data?.clipData
        if (clip != null) {
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i)?.uri?.let { uris.add(it) }
            }
        } else if (data?.data != null) {
            data.data?.let { uris.add(it) }
        } else if (cameraUri != null && cameraFile != null && cameraFile.exists() && cameraFile.length() > 0L) {
            uris.add(cameraUri)
        }

        callback.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
    }

    inner class AndroidBridge {
        @Keep
        @JavascriptInterface
        fun setTheme(theme: String) {
            runOnUiThread {
                val dark = theme == "dark"
                @Suppress("DEPRECATION")
                window.statusBarColor = Color.parseColor(if (dark) "#0B0B1E" else "#0404E2")
                @Suppress("DEPRECATION")
                window.navigationBarColor = Color.parseColor(if (dark) "#15152F" else "#FFFFFF")
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.isAppearanceLightStatusBars = false
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    controller.isAppearanceLightNavigationBars = !dark
                }
            }
        }

        @Keep
        @JavascriptInterface
        fun printPage(jobName: String) {
            val safeJobName = jobName.ifBlank { "Comprovante FixUp" }
            runOnUiThread {
                suppressNextSplash = true
                val printManager = getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return@runOnUiThread
                val baseAdapter = webView.createPrintDocumentAdapter(safeJobName)
                val wrapper = object : PrintDocumentAdapter() {
                    override fun onStart() = baseAdapter.onStart()

                    override fun onLayout(
                        oldAttributes: PrintAttributes?,
                        newAttributes: PrintAttributes?,
                        cancellationSignal: CancellationSignal?,
                        callback: LayoutResultCallback?,
                        extras: Bundle?
                    ) = baseAdapter.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras)

                    override fun onWrite(
                        pages: Array<out PageRange>?,
                        destination: ParcelFileDescriptor?,
                        cancellationSignal: CancellationSignal?,
                        callback: WriteResultCallback?
                    ) = baseAdapter.onWrite(pages, destination, cancellationSignal, callback)

                    override fun onFinish() {
                        baseAdapter.onFinish()
                        suppressNextSplash = false
                        webView.post {
                            webView.evaluateJavascript(
                                "window.dispatchEvent(new Event('afterprint'));",
                                null
                            )
                        }
                    }
                }
                printManager.print(safeJobName, wrapper, PrintAttributes.Builder().build())
            }
        }

        @Keep
        @JavascriptInterface
        fun saveReceipt(fileName: String, htmlContent: String): Boolean {
            val safeName = fileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            val bytes = htmlContent.toByteArray(Charsets.UTF_8)
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                        put(MediaStore.Downloads.MIME_TYPE, "text/html")
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: return false
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return false
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    contentResolver.update(uri, values, null, null)
                    true
                } else {
                    @Suppress("DEPRECATION")
                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    if (!downloadsDir.exists()) downloadsDir.mkdirs()
                    File(downloadsDir, safeName).writeBytes(bytes)
                    true
                }
            } catch (_: Exception) {
                try {
                    val fallbackDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
                    if (!fallbackDir.exists()) fallbackDir.mkdirs()
                    File(fallbackDir, safeName).writeBytes(bytes)
                    true
                } catch (_: Exception) {
                    false
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
            userAgentString = "$userAgentString FixUpAndroid/3.0.0"
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
                suppressNextSplash = true
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback

                val cameraIntent = createCameraIntent()
                val allowMultiple = fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE
                val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
                }

                val targetIntent = if (fileChooserParams.isCaptureEnabled && cameraIntent != null) {
                    cameraIntent
                } else {
                    Intent.createChooser(galleryIntent, "Selecionar imagem").apply {
                        if (cameraIntent != null) {
                            putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                        }
                    }
                }

                return try {
                    suppressNextSplash = true
                    fileChooserLauncher.launch(targetIntent)
                    true
                } catch (_: Exception) {
                    suppressNextSplash = false
                    pendingFileCallback = null
                    pendingCameraUri = null
                    pendingCameraFile = null
                    filePathCallback.onReceiveValue(null)
                    false
                }
            }
        }

        setContentView(webView)
        setupBackNavigation()
        webView.loadUrl(APP_START_URL)
    }

    private fun createCameraIntent(): Intent? {
        return try {
            val dir = File(cacheDir, "camera").apply { mkdirs() }
            val file = File.createTempFile("fixup_", ".jpg", dir)
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            if (intent.resolveActivity(packageManager) == null) {
                file.delete()
                null
            } else {
                pendingCameraFile = file
                pendingCameraUri = uri
                intent
            }
        } catch (_: Exception) {
            null
        }
    }

    override fun onRestart() {
        super.onRestart()
        if (suppressNextSplash) {
            suppressNextSplash = false
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
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        pendingCameraUri = null
        pendingCameraFile = null
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
              if (fx.media && fx.media.isOpen && fx.media.isOpen()) {
                fx.media.close();
                return 'handled';
              }
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
