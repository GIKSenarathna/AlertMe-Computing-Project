package com.alertme.backend.controller;

import com.alertme.backend.model.Citizen;
import com.alertme.backend.service.CitizenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/citizens")
@RequiredArgsConstructor
public class CitizenController {

    private final CitizenService citizenService;

    @PostMapping("/register")
    public ResponseEntity<Citizen> registerCitizen(@RequestBody Citizen citizen) {
        return new ResponseEntity<>(citizenService.registerCitizen(citizen), HttpStatus.CREATED);
    }

    @GetMapping("/{citizenId}")
    public ResponseEntity<Citizen> getCitizen(@PathVariable String citizenId) {
        return citizenService.findById(citizenId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/phone/{phoneNumber}")
    public ResponseEntity<Citizen> getCitizenByPhone(@PathVariable String phoneNumber) {
        return citizenService.findByPhoneNumber(phoneNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Citizen>> getAllCitizens() {
        return ResponseEntity.ok(citizenService.getAllCitizens());
    }
}
