package com.blackhole21.game;

import android.os.Bundle;
import android.os.Handler;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private final Handler pushHandler = new Handler();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The Push Notifications Capacitor plugin is installed natively by
        // `npx cap sync android`. Only inject our small app-side registration
        // script; never download executable plugin code at runtime.
        pushHandler.postDelayed(this::injectPushRegistrationScript, 1000);
    }

    private void injectPushRegistrationScript() {
        WebView webView = getBridge().getWebView();
        try (InputStream input = getAssets().open("public/push-notifications.js");
             BufferedReader reader = new BufferedReader(
                     new InputStreamReader(input, StandardCharsets.UTF_8))) {
            StringBuilder script = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                script.append(line).append('\n');
            }
            webView.evaluateJavascript(script.toString(), result -> {
                // The JS file emits all useful diagnostics through [push] logs.
            });
        } catch (Exception e) {
            android.util.Log.e("BlackHole21", "[push] failed to load local registration script", e);
        }
    }

    @Override
    public void onDestroy() {
        pushHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
