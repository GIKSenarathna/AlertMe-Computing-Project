package com.alertme.backend.repository;

import com.alertme.backend.model.Dispatcher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DispatcherRepository extends JpaRepository<Dispatcher, String> {
    // Custom query to find dispatchers by their phone number for authentication
    Optional<Dispatcher> findByPhoneNumber(String phoneNumber);

    // Find dispatcher by email for email/password Firebase auth flow
    Optional<Dispatcher> findByEmail(String email);
}
