package com.alertme.backend.repository;

import com.alertme.backend.model.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, String> {
    List<Incident> findByReporter_CitizenId(String reporterId);
    List<Incident> findByStatus(String status);
    List<Incident> findByStatusIn(List<String> statuses);
    List<Incident> findByStatusNot(String status);
    List<Incident> findByReportedAtAfter(LocalDateTime since);
}
