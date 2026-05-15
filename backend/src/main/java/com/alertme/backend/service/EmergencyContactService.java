package com.alertme.backend.service;

import com.alertme.backend.model.EmergencyContact;
import com.alertme.backend.repository.EmergencyContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmergencyContactService {

    private final EmergencyContactRepository contactRepository;

    public EmergencyContact addContact(EmergencyContact contact) {
        return contactRepository.save(contact);
    }

    public List<EmergencyContact> getContactsByCitizenId(String citizenId) {
        return contactRepository.findByCitizen_CitizenId(citizenId);
    }

    public void deleteContact(String contactId) {
        contactRepository.deleteById(contactId);
    }
}
