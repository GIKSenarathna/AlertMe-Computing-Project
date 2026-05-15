package com.alertme.backend.controller;

import com.alertme.backend.dto.AuthResponseDTO;
import com.alertme.backend.dto.LoginRequestDTO;
import com.alertme.backend.model.Citizen;
import com.alertme.backend.model.Dispatcher;
import com.alertme.backend.repository.CitizenRepository;
import com.alertme.backend.repository.DispatcherRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final CitizenRepository citizenRepository;
    private final DispatcherRepository dispatcherRepository;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request) {
        log.info("🔐 Login attempt received — processing Firebase token");
        try {
            // 1. Verify the Firebase ID token
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(request.getIdToken());
            String uid = decodedToken.getUid();
            String phoneNumber = (String) decodedToken.getClaims().get("phone_number");
            
            if (phoneNumber == null) {
                phoneNumber = decodedToken.getEmail();
            }

            if (phoneNumber == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Could not identify user from token");
            }

            // 2. Check if a Dispatcher exists — try phone number first, then email
            Optional<Dispatcher> dispatcherOpt = Optional.empty();
            if (phoneNumber != null) {
                dispatcherOpt = dispatcherRepository.findByPhoneNumber(phoneNumber);
            }
            // Fallback: look up by email (used when dispatcher signs in with email/password on the web dashboard)
            if (dispatcherOpt.isEmpty() && decodedToken.getEmail() != null) {
                dispatcherOpt = dispatcherRepository.findByEmail(decodedToken.getEmail());
            }

            // Only treat as a dispatcher if they have an actual operational role (not STANDARD)
            // STANDARD accounts are mobile app users who may have been added to the dispatcher table accidentally
            boolean isRealDispatcher = dispatcherOpt.isPresent() && 
                dispatcherOpt.get().getAccessLevel() != null &&
                !dispatcherOpt.get().getAccessLevel().equalsIgnoreCase("STANDARD");

            if (isRealDispatcher) {
                Dispatcher d = dispatcherOpt.get();
                if (d.getFirebaseUid() == null) {
                    d.setFirebaseUid(uid);
                    dispatcherRepository.save(d);
                }
                return ResponseEntity.ok(AuthResponseDTO.builder()
                        .token(request.getIdToken()) // Return the same token for client to use
                        .role(d.getAccessLevel())
                        .userId(d.getDispatcherId())
                        .name(d.getName())
                        .build());
            }

            // 3. Handle Citizen flow - auto-register if new
            Citizen citizen = citizenRepository.findByPhoneNumber(phoneNumber)
                    .orElseGet(() -> {
                        Citizen newCitizen = Citizen.builder()
                                .phoneNumber((String) decodedToken.getClaims().get("phone_number")) // fallback to raw claims
                                .firebaseUid(uid)
                                .name(decodedToken.getName() != null ? decodedToken.getName() : "AlertMe User")
                                .emergencyAlertsEnabled(true)
                                .autoSyncData(true)
                                .locationServicesAlwaysOn(false)
                                .build();
                        
                        // Ensure phone number isn't null if extracted via different claims
                        if (newCitizen.getPhoneNumber() == null) newCitizen.setPhoneNumber((String) decodedToken.getClaims().get("phone_number"));
                        
                        return citizenRepository.save(newCitizen);
                    });

            if (citizen.getFirebaseUid() == null) {
                citizen.setFirebaseUid(uid);
                citizenRepository.save(citizen);
            }

            return ResponseEntity.ok(AuthResponseDTO.builder()
                    .token(request.getIdToken())
                    .role("CITIZEN")
                    .userId(citizen.getCitizenId())
                    .name(citizen.getName())
                    .build());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Firebase verification failed: " + e.getMessage());
        }
    }
}
