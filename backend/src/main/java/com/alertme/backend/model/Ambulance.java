package com.alertme.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

@Entity
@Table(name = "ambulances")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ambulance {

    @Id
    @Column(name = "vehicle_id", nullable = false, updatable = false)
    private String vehicleId; // Explicit input like "AMB-001"

    @Column(nullable = false)
    private String crewName;

    @Column(nullable = false)
    private String capabilityType; // BASIC, ICU, ADVANCED

    // Unidirectional mapping to its current mapped location ping
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "current_location_id")
    private Location currentLocation;

    // Permanent home base / station GPS — never changes after registration
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "station_location_id")
    private Location stationLocation;

    @Column(nullable = false)
    private String currentStatus; // AVAILABLE, EN_ROUTE, ON_SCENE

    // Additional Fleet Metadata
    private String driverPhone;
    private String licensePlate;
    private String stationName;
    
    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "registered_at", updatable = false)
    private java.time.LocalDateTime registeredAt;
}
