package com.alertme.backend.service;

import com.alertme.backend.model.Citizen;
import com.alertme.backend.repository.CitizenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CitizenService {

    private final CitizenRepository citizenRepository;

    public Citizen registerCitizen(Citizen citizen) {
        // Encapsulate any validation or default-setting logic here before saving
        return citizenRepository.save(citizen);
    }

    public Optional<Citizen> findByPhoneNumber(String phoneNumber) {
        return citizenRepository.findByPhoneNumber(phoneNumber);
    }

    public Optional<Citizen> findById(String citizenId) {
        return citizenRepository.findById(citizenId);
    }

    public List<Citizen> getAllCitizens() {
        return citizenRepository.findAll();
    }
}
