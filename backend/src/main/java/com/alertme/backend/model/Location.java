package com.alertme.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

@Entity
@Table(name = "locations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "location_id", nullable = false, updatable = false)
    private String locationId;

    @Column(nullable = false)
    private float latitude;

    @Column(nullable = false)
    private float longitude;

    private float accuracyRadius;
    private String approximateAddress;
}
