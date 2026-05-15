package com.alertme.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "emergency_contacts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmergencyContact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "contact_id", nullable = false, updatable = false)
    private String contactId;

    // Many-to-One mapping to Citizen (A Citizen can have multiple emergency contacts)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "citizen_id", nullable = false)
    @JsonIgnore
    private Citizen citizen;

    @Column(nullable = false)
    private String name;

    private String relationship;
    
    @Column(nullable = false)
    private String phoneNumber;
    
    private String email;
    private boolean isPrimary;
    private boolean isNotifyEnabled;
}
