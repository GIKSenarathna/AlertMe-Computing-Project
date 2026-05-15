package com.alertme.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "authority_responses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthorityResponse {

    @Id
    @Column(name = "response_id", nullable = false, updatable = false)
    private String id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "incident_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "authorityResponses", "reporter", "evidences"})
    private Incident incident;

    @Column(name = "authority_type", nullable = false)
    private String authorityType; // FIRE, POLICE, MEDICAL

    @Column(nullable = false)
    private String status; // PENDING, ACKNOWLEDGED, DISPATCHED, ON_SCENE, COMPLETED

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;


    @Column(name = "acknowledged_by")
    private String acknowledgedBy; // dispatcherId

    @PrePersist
    protected void onCreate() {
        this.id = UUID.randomUUID().toString();
        this.updatedAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = "PENDING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
