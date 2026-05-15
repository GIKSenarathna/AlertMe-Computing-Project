package com.alertme.backend.repository;

import com.alertme.backend.model.Evidence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EvidenceRepository extends JpaRepository<Evidence, String> {
    List<Evidence> findByIncident_IncidentId(String incidentId);
    List<Evidence> findByMediaType(String mediaType);
}
