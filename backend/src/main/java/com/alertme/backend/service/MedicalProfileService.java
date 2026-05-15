package com.alertme.backend.service;

import com.alertme.backend.model.MedicalProfile;
import com.alertme.backend.model.Citizen;
import com.alertme.backend.repository.MedicalProfileRepository;
import com.alertme.backend.repository.CitizenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.alertme.backend.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class MedicalProfileService {

    private final MedicalProfileRepository medicalProfileRepository;
    private final CitizenRepository citizenRepository;

    public MedicalProfile saveProfile(MedicalProfile profile) {
        if (profile.getCitizen() != null && profile.getCitizen().getCitizenId() != null) {
            String citizenId = profile.getCitizen().getCitizenId();
            
            // Sync user's actual name to eliminate 'AlertMe User' duplicates natively
            if (profile.getCitizen().getName() != null && !profile.getCitizen().getName().trim().isEmpty()) {
                Citizen c = citizenRepository.findById(citizenId)
                    .orElseThrow(() -> new ResourceNotFoundException("Citizen not found with ID: " + citizenId));
                c.setName(profile.getCitizen().getName().trim());
                citizenRepository.save(c);
            }

            Optional<MedicalProfile> existing = medicalProfileRepository.findByCitizen_CitizenId(citizenId);
            
            if (existing.isPresent()) {
                MedicalProfile current = existing.get();
                current.setBloodGroup(profile.getBloodGroup());
                current.setAllergies(profile.getAllergies());
                current.setChronicConditions(profile.getChronicConditions());
                current.setCurrentMedications(profile.getCurrentMedications());
                current.setSpecialNotes(profile.getSpecialNotes());
                return medicalProfileRepository.save(current);
            }
            
            // For new profiles, fetch the fully managed Citizen entity first if we didn't just update them
            Citizen citizen = citizenRepository.findById(citizenId)
                    .orElseThrow(() -> new ResourceNotFoundException("Citizen not found with ID: " + citizenId));
            profile.setCitizen(citizen);
        }
        return medicalProfileRepository.save(profile);
    }

    public Optional<MedicalProfile> getProfileByCitizenId(String citizenId) {
        return medicalProfileRepository.findByCitizen_CitizenId(citizenId);
    }
}
