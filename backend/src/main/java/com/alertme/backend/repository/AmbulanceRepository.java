package com.alertme.backend.repository;

import com.alertme.backend.model.Ambulance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AmbulanceRepository extends JpaRepository<Ambulance, String> {
    List<Ambulance> findByCurrentStatus(String status);
}
