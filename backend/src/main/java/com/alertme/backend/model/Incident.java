package com.alertme.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;

@Entity
@Table(name = "incidents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "incident_id", nullable = false, updatable = false)
    private String incidentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Citizen reporter;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "location_id", nullable = false)
    private Location location;

    @Column(nullable = false, updatable = false)
    private LocalDateTime reportedAt;

    @Column(nullable = false)
    private String type; // e.g. Vehicle, Medical, Fire

    @Min(1)
    @Max(10)
    private int severityScore;
    
    @Column(nullable = false)
    private String status; // Allowed values: "Active", "Dispatched", "Resolved"

    private String finalOutcome;

    @PrePersist
    public void onCreate() {
        if (this.reportedAt == null) {
            this.reportedAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = "Active";
        }
    }
}
