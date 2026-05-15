package com.alertme.backend.controller;

import com.alertme.backend.model.Ambulance;
import com.alertme.backend.service.AmbulanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ambulances")
@RequiredArgsConstructor
public class AmbulanceController {

    private final AmbulanceService ambulanceService;

    @PostMapping("/register")
    public ResponseEntity<Ambulance> registerAmbulance(@RequestBody Ambulance ambulance) {
        return new ResponseEntity<>(ambulanceService.registerAmbulance(ambulance), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Ambulance>> getAllAmbulances() {
        List<Ambulance> list = ambulanceService.getAllAmbulances();
        list.stream().filter(a -> "AMB-WP-001".equals(a.getVehicleId())).findFirst()
            .ifPresent(a -> System.out.println("DEBUG AMB-WP-001 STATUS: " + a.getCurrentStatus()));
        return ResponseEntity.ok(list);
    }

    @GetMapping("/available")
    public ResponseEntity<List<Ambulance>> getAvailableAmbulances() {
        return ResponseEntity.ok(ambulanceService.getAvailableAmbulances());
    }

    @GetMapping("/{vehicleId}")
    public ResponseEntity<Ambulance> getAmbulanceById(@PathVariable String vehicleId) {
        return ambulanceService.getAmbulanceById(vehicleId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{vehicleId}/status")
    public ResponseEntity<Ambulance> updateAmbulanceStatus(@PathVariable String vehicleId, @RequestBody java.util.Map<String, String> payload) {
        String newStatus = payload.get("status");
        if (newStatus == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(ambulanceService.updateAmbulanceStatus(vehicleId, newStatus));
    }
}
