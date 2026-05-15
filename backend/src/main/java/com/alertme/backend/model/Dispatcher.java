package com.alertme.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispatchers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Dispatcher {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "dispatcher_id", nullable = false, updatable = false)
    private String dispatcherId;

    @Column(name = "station_id")
    private String stationId;

    @Column(name = "phone_number", unique = true)
    private String phoneNumber;

    @Column(name = "email", unique = true)
    private String email;

    @Column(name = "firebase_uid", unique = true)
    private String firebaseUid;

    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String languageCode;
    
    @Column(name = "is_online")
    private boolean isOnlineLegacy;

    @Column(name = "online")
    private boolean online;
    
    // Command access authorization level
    @Column(nullable = false)
    private String accessLevel;

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
