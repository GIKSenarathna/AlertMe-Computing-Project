package com.alertme.backend.repository;

import com.alertme.backend.model.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, String> {
    // Returns the full list of emergency contacts associated with a specific citizen
    List<EmergencyContact> findByCitizen_CitizenId(String citizenId);
}
