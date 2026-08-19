package com.blackhole21.game;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PUSH_PLUGIN_URL =
            "https://cdn.jsdelivr.net/npm/@capacitor/push-notifications@8.1.2/dist/plugin.js";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url == null || !url.startsWith("https://black-hole-21.onrender.com")) {
                    return;
                }

                String script =
                        "(function(){" +
                        "if(window.__bh21PushInjected)return;" +
                        "window.__bh21PushInjected=true;" +
                        "var s=document.createElement('script');" +
                        "s.src='" + PUSH_PLUGIN_URL + "';" +
                        "s.onload=function(){" +
                        "var p=document.createElement('script');" +
                        "p.src='push-notifications.js';" +
                        "document.head.appendChild(p);" +
                        "};" +
                        "s.onerror=function(e){console.error('[push] failed to load Capacitor PushNotifications plugin',e);};" +
                        "document.head.appendChild(s);" +
                        "})();";
                view.evaluateJavascript(script, null);
            }
        });
    }
}
