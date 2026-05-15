package com.alertme.backend.repository;

import com.alertme.backend.model.MedicalProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MedicalProfileRepository extends JpaRepository<MedicalProfile, String> {
    // Navigate through the OneToOne mapping to explicitly retrieve the profile data linked to a citizen
    Optional<MedicalProfile> findByCitizen_CitizenId(String citizenId);
}
