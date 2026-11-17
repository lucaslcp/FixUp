# Regras ProGuard / R8 para o app FixUp
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class app.fixup.mobile.MainActivity$AndroidBridge { *; }
