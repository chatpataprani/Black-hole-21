package com.blackhole21.game;

import android.os.Bundle;
import android.os.Handler;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PUSH_PLUGIN_URL =
            "https://cdn.jsdelivr.net/npm/@capacitor/push-notifications@8.1.2/dist/plugin.js";
    private final Handler pushHandler = new Handler();
    private int pushInjectionAttempts = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        schedulePushInjection();
    }

    private void schedulePushInjection() {
        pushHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                WebView webView = getBridge().getWebView();
                String script =
                        "(function(){" +
                        "if(window.__bh21PushInjected)return 'done';" +
                        "if(!window.Capacitor)return 'waiting';" +
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
                        "return 'injected';" +
                        "})();";

                webView.evaluateJavascript(script, result -> {
                    if ("\"waiting\"".equals(result) && pushInjectionAttempts++ < 60) {
                        schedulePushInjection();
                    }
                });
            }
        }, 500);
    }

    @Override
    public void onDestroy() {
        pushHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
