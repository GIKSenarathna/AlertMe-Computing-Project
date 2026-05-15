package com.alertme.backend.controller;

import com.alertme.backend.model.MedicalProfile;
import com.alertme.backend.service.MedicalProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/medical-profiles")
@RequiredArgsConstructor
public class MedicalProfileController {

    private final MedicalProfileService profileService;

    @PostMapping
    public ResponseEntity<MedicalProfile> saveProfile(@RequestBody MedicalProfile profile) {
        return new ResponseEntity<>(profileService.saveProfile(profile), HttpStatus.CREATED);
    }

    @GetMapping("/citizen/{citizenId}")
    public ResponseEntity<MedicalProfile> getProfileByCitizenId(@PathVariable String citizenId) {
        return profileService.getProfileByCitizenId(citizenId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
