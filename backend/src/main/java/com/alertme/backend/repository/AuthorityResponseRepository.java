package com.alertme.backend.repository;

import com.alertme.backend.model.AuthorityResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuthorityResponseRepository extends JpaRepository<AuthorityResponse, String> {
    List<AuthorityResponse> findByIncident_IncidentId(String incidentId);
    List<AuthorityResponse> findByIncident_StatusNot(String status);

    @org.springframework.data.jpa.repository.Query("SELECT a FROM AuthorityResponse a WHERE a.incident.status != 'Resolved' OR a.status != 'COMPLETED'")
    List<AuthorityResponse> findActiveOrIncompleteResponses();
}
