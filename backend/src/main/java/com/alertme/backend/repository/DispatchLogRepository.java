package com.alertme.backend.repository;

import com.alertme.backend.model.DispatchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DispatchLogRepository extends JpaRepository<DispatchLog, String> {
    List<DispatchLog> findByIncident_IncidentId(String incidentId);
    List<DispatchLog> findByAmbulance_VehicleId(String vehicleId);
    List<DispatchLog> findByStatus(String status);
    List<DispatchLog> findByStatusIn(List<String> statuses);
}
