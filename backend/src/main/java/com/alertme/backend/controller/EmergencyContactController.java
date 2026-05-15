package com.alertme.backend.controller;

import com.alertme.backend.model.EmergencyContact;
import com.alertme.backend.service.EmergencyContactService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/emergency-contacts")
@RequiredArgsConstructor
public class EmergencyContactController {

    private final EmergencyContactService contactService;

    @PostMapping
    public ResponseEntity<EmergencyContact> addContact(@RequestBody EmergencyContact contact) {
        return new ResponseEntity<>(contactService.addContact(contact), HttpStatus.CREATED);
    }

    @GetMapping("/citizen/{citizenId}")
    public ResponseEntity<List<EmergencyContact>> getContactsByCitizen(@PathVariable String citizenId) {
        return ResponseEntity.ok(contactService.getContactsByCitizenId(citizenId));
    }

    @DeleteMapping("/{contactId}")
    public ResponseEntity<Void> deleteContact(@PathVariable String contactId) {
        contactService.deleteContact(contactId);
        return ResponseEntity.noContent().build();
    }
}
