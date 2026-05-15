package com.alertme.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    @Value("${alertme.firebase.config-path:serviceAccountKey.json}")
    private String configPath;

    @PostConstruct
    public void initialize() {
        try {
            InputStream serviceAccount = getClass().getClassLoader().getResourceAsStream(configPath);
            
            if (serviceAccount == null) {
                System.err.println("🚨 Firebase Service Account file NOT FOUND at: " + configPath);
                System.err.println("Please place your serviceAccountKey.json in src/main/resources/");
                return;
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .setStorageBucket("alertme-b1834.firebasestorage.app")
                    .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
                System.out.println("🔥 Firebase Admin SDK initialized successfully.");
            }
        } catch (IOException e) {
            System.err.println("🚨 Failed to initialize Firebase Admin SDK: " + e.getMessage());
        }
    }
}
