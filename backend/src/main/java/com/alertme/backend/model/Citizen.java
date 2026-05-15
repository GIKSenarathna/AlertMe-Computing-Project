package com.alertme.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;

@Entity
@Table(name = "citizens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Citizen {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "citizen_id", nullable = false, updatable = false)
    private String citizenId;

    @Column(name = "phone_number", nullable = false, unique = true)
    private String phoneNumber;

    @Column(name = "firebase_uid", unique = true)
    private String firebaseUid;

    @Column(nullable = false)
    private String name;
    private String languageCode;

    // Preferences
    private String themePreference;
    private boolean emergencyAlertsEnabled;
    private boolean autoSyncData;
    private boolean locationServicesAlwaysOn;
    
    // Status
    @Builder.Default
    @Column(name = "is_online")
    private Boolean isOnlineLegacy = false;

    private boolean online;

    private LocalDateTime createdAt;
    private LocalDateTime lastUpdated;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.lastUpdated = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.lastUpdated = LocalDateTime.now();
    }
}
