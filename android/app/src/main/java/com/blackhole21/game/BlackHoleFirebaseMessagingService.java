package com.blackhole21.game;

import android.Manifest;
import android.content.pm.PackageManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.concurrent.atomic.AtomicInteger;

public class BlackHoleFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BlackHole21";
    private static final String CHANNEL_ID = "black_hole_21_notifications";
    private static final AtomicInteger NOTIFICATION_ID = new AtomicInteger(1000);

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "[push] FCM token refreshed: " + token);
        PushTokenRegistrar.send(this, token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        String title = remoteMessage.getNotification() != null
                ? remoteMessage.getNotification().getTitle()
                : null;
        String body = remoteMessage.getNotification() != null
                ? remoteMessage.getNotification().getBody()
                : null;

        if (title == null || title.trim().isEmpty()) title = "Black Hole 21";
        if (body == null || body.trim().isEmpty()) body = "You have a new message.";

        Log.d(TAG, "[push] message received while app is active: " + title);

        if (android.os.Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "[push] notification received but POST_NOTIFICATIONS is not granted");
            return;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE);

        NotificationManagerCompat.from(this).notify(NOTIFICATION_ID.incrementAndGet(), builder.build());
    }
}
