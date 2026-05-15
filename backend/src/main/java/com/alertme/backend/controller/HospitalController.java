package com.alertme.backend.controller;

import com.alertme.backend.model.Hospital;
import com.alertme.backend.repository.HospitalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
public class HospitalController {

    private final HospitalRepository hospitalRepository;

    @GetMapping
    public ResponseEntity<List<Hospital>> getAllHospitals() {
        return ResponseEntity.ok(hospitalRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Hospital> createHospital(@RequestBody Hospital hospital) {
        return ResponseEntity.ok(hospitalRepository.save(hospital));
    }

    /**
     * Seeds a set of real Sri Lankan hospitals on first startup.
     * Only runs if the hospitals table is empty.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void seedHospitals() {
        if (hospitalRepository.count() > 0) return;

        hospitalRepository.saveAll(List.of(
            Hospital.builder().name("Teaching Hospital Karapitiya").latitude(6.0367).longitude(80.2170).address("Karapitiya, Galle").district("Galle").type("TEACHING").build(),
            Hospital.builder().name("National Hospital of Sri Lanka").latitude(6.9167).longitude(79.8728).address("Regent Street, Colombo 10").district("Colombo").type("TEACHING").build(),
            Hospital.builder().name("Lady Ridgeway Hospital").latitude(6.9037).longitude(79.8764).address("Borella, Colombo 8").district("Colombo").type("GENERAL").build(),
            Hospital.builder().name("Colombo South Teaching Hospital").latitude(6.8281).longitude(79.8772).address("Kalubowila, Dehiwala").district("Colombo").type("TEACHING").build(),
            Hospital.builder().name("Base Hospital Ratnapura").latitude(6.6829).longitude(80.3992).address("Ratnapura").district("Sabaragamuwa").type("BASE").build(),
            Hospital.builder().name("District General Hospital Embilipitiya").latitude(6.3366).longitude(80.8459).address("Embilipitiya").district("Sabaragamuwa").type("GENERAL").build(),
            Hospital.builder().name("Teaching Hospital Peradeniya").latitude(7.2553).longitude(80.5984).address("Peradeniya, Kandy").district("Kandy").type("TEACHING").build(),
            Hospital.builder().name("District General Hospital Kurunegala").latitude(7.4867).longitude(80.3647).address("Kurunegala").district("Kurunegala").type("GENERAL").build(),
            Hospital.builder().name("Teaching Hospital Jaffna").latitude(9.6683).longitude(80.0053).address("Jaffna").district("Jaffna").type("TEACHING").build(),
            Hospital.builder().name("Base Hospital Polonnaruwa").latitude(7.9403).longitude(81.0188).address("Polonnaruwa").district("Polonnaruwa").type("BASE").build()
        ));

        System.out.println("[Hospital Seeder] Seeded 10 hospitals into the database.");
    }
}
