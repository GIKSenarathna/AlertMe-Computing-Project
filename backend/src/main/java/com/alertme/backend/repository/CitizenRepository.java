package com.alertme.backend.repository;

import com.alertme.backend.model.Citizen;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CitizenRepository extends JpaRepository<Citizen, String> {
    // Custom query to find citizens by their phone number for authentication
    Optional<Citizen> findByPhoneNumber(String phoneNumber);
}
