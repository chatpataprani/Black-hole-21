package com.blackhole21.game;

import android.Manifest;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BlackHole21";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2101;
    private static final String CHANNEL_ID = "black_hole_21_notifications";
    private static final String PREFS = "black_hole_21";
    private static final String PREF_NOTIFICATION_PROMPT = "notification_prompt_shown";
    private static final String UPDATE_MANIFEST_URL = "https://black-hole-21.onrender.com/app-update.json";
    private static final Pattern JSON_STRING = Pattern.compile("\\\"%s\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    private static final Pattern JSON_NUMBER = Pattern.compile("\\\"%s\\\"\\s*:\\s*(\\d+)");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        setupPushNotifications();
        checkForAppUpdate();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            registerFcmToken();
        }
        checkForAppUpdate();
    }

    private void setupPushNotifications() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean promptShown = prefs.getBoolean(PREF_NOTIFICATION_PROMPT, false);

        // Android 10/11 do not have a runtime notification permission. We still
        // show our own one-time explanation so a fresh APK install explicitly
        // asks the player to enable notifications.
        if (!promptShown) {
            showNotificationEnablePrompt();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestNotificationPermission();
            return;
        }

        registerFcmToken();
    }

    private void showNotificationEnablePrompt() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        prefs.edit().putBoolean(PREF_NOTIFICATION_PROMPT, true).apply();

        new AlertDialog.Builder(this)
                .setTitle("Enable notifications")
                .setMessage("Get Black Hole 21 admin broadcasts and important game updates on this phone.")
                .setNegativeButton("Not now", null)
                .setPositiveButton("Enable", (dialog, which) -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        requestNotificationPermission();
                    } else {
                        registerFcmToken();
                        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
                            try {
                                Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                                startActivity(intent);
                            } catch (Exception e) {
                                Log.e(TAG, "[push] could not open notification settings", e);
                            }
                        }
                    }
                })
                .show();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Log.d(TAG, "[push] requesting Android 13+ POST_NOTIFICATIONS permission");
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST
            );
        } else {
            registerFcmToken();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != NOTIFICATION_PERMISSION_REQUEST) return;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "[push] notification permission granted");
            registerFcmToken();
        } else {
            Log.e(TAG, "[push] notification permission denied");
        }
    }

    private void registerFcmToken() {
        Log.d(TAG, "[push] requesting FCM registration token");
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) {
                        Log.e(TAG, "[push] FCM token request failed", task.getException());
                        return;
                    }

                    String token = task.getResult();
                    if (token == null || token.isEmpty()) {
                        Log.e(TAG, "[push] FCM returned an empty token");
                        return;
                    }

                    Log.d(TAG, "[push] FCM registration token: " + token);
                    PushTokenRegistrar.send(this, token);
                });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Black Hole 21 notifications",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Black Hole 21 game notifications");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void checkForAppUpdate() {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(UPDATE_MANIFEST_URL + "?t=" + System.currentTimeMillis()).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestProperty("Cache-Control", "no-cache");
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) return;
                String json = readStream(connection.getInputStream());
                int latestVersionCode = getJsonInt(json, "versionCode", -1);
                String versionName = getJsonString(json, "versionName");
                String apkUrl = getJsonString(json, "apkUrl");
                String notes = getJsonString(json, "notes");
                if (latestVersionCode <= getCurrentVersionCode() || apkUrl == null || apkUrl.isEmpty()) return;

                runOnUiThread(() -> showUpdateDialog(latestVersionCode, versionName, apkUrl, notes));
            } catch (Exception e) {
                Log.d(TAG, "[update] check skipped: " + e.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "BlackHole21-UpdateCheck").start();
    }

    private void showUpdateDialog(int versionCode, String versionName, String apkUrl, String notes) {
        if (isFinishing()) return;
        String message = "A new version of Black Hole 21 is available.";
        if (versionName != null && !versionName.isEmpty()) message += "\\n\\nVersion " + versionName + ".";
        if (notes != null && !notes.isEmpty()) message += "\\n\\n" + notes;

        new AlertDialog.Builder(this)
                .setTitle("Update available")
                .setMessage(message)
                .setNegativeButton("Later", null)
                .setPositiveButton("Update now", (dialog, which) -> downloadUpdate(apkUrl, versionCode))
                .show();
    }

    private void downloadUpdate(String apkUrl, int versionCode) {
        try {
            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager == null) throw new IllegalStateException("Download service unavailable");

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl));
            request.setTitle("Black Hole 21 update");
            request.setDescription("Downloading the latest game update");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "Black-Hole-21-update-" + versionCode + ".apk");

            long id = manager.enqueue(request);
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong("update_download_id", id).apply();
            android.widget.Toast.makeText(this, "Downloading update…", android.widget.Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Log.e(TAG, "[update] download failed", e);
            android.widget.Toast.makeText(this, "Update download failed. Try again later.", android.widget.Toast.LENGTH_LONG).show();
        }
    }

    private int getCurrentVersionCode() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 1;
        }
    }

    private static String readStream(InputStream stream) throws Exception {
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }

    private static int getJsonInt(String json, String key, int fallback) {
        Matcher matcher = Pattern.compile(String.format(JSON_NUMBER.pattern(), Pattern.quote(key))).matcher(json);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : fallback;
    }

    private static String getJsonString(String json, String key) {
        Matcher matcher = Pattern.compile(String.format(JSON_STRING.pattern(), Pattern.quote(key))).matcher(json);
        return matcher.find() ? matcher.group(1).replace("\\n", "\n") : null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }
}
