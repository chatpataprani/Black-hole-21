package com.blackhole21.game;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BlackHole21";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2101;
    private static final String CHANNEL_ID = "black_hole_21_notifications";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        setupPushNotifications();
    }

    private void setupPushNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
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
            Log.e(TAG, "[push] notification permission denied; FCM token registration will not be started");
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

    @Override
    public void onDestroy() {
        super.onDestroy();
    }
}
