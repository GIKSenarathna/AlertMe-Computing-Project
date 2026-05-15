package com.alertme.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "medical_profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MedicalProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "profile_id", nullable = false, updatable = false)
    private String profileId;

    // One-to-One mapping to Citizen
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "citizen_id", nullable = false, unique = true)
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    private Citizen citizen;

    private String bloodGroup;
    private String allergies;
    private String chronicConditions;
    private String currentMedications;
    private String specialNotes;
    
    private LocalDateTime lastUpdated;

    @PrePersist
    @PreUpdate
    public void onUpdate() {
        this.lastUpdated = LocalDateTime.now();
    }
}
