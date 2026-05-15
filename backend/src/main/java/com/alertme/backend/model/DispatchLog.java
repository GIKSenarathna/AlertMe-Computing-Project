package com.alertme.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispatch_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class DispatchLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "dispatch_id", nullable = false, updatable = false)
    private String dispatchId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "incident_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "reporter"})
    private Incident incident;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "vehicle_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Ambulance ambulance;

    @Column(nullable = false, updatable = false)
    private LocalDateTime assignedAt;

    private int estimatedEtaSeconds;

    @Column(nullable = false)
    private String status; // ASSIGNED, ARRIVED, COMPLETED

    private String navigationRoute; // Encoded polyline or JSON string

    // Transport destination (set when ambulance picks up patient)
    private String destinationHospitalName;
    private Double destinationHospitalLat;
    private Double destinationHospitalLng;
    private String destinationHospitalAddress;
    
    // Performance Tracking
    private LocalDateTime completedAt;

    @PrePersist
    public void onCreate() {
        if (this.assignedAt == null) {
            this.assignedAt = LocalDateTime.now();
        }
    }
}
