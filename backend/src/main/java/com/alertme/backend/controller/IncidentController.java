package com.alertme.backend.controller;

import com.alertme.backend.dto.IncidentRequestDTO;
import com.alertme.backend.dto.IncidentResponseDTO;
import com.alertme.backend.model.DispatchLog;
import com.alertme.backend.service.DispatchLogService;
import com.alertme.backend.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;
    private final DispatchLogService dispatchLogService;

    @PostMapping
    public ResponseEntity<IncidentResponseDTO> reportIncident(@Valid @RequestBody IncidentRequestDTO request) {
        return new ResponseEntity<>(incidentService.reportIncident(request), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<IncidentResponseDTO>> getAllIncidents() {
        return ResponseEntity.ok(incidentService.getAllIncidents());
    }

    @GetMapping("/active")
    public ResponseEntity<List<IncidentResponseDTO>> getActiveIncidents() {
        return ResponseEntity.ok(incidentService.getActiveIncidents());
    }

    @GetMapping("/{incidentId}")
    public ResponseEntity<IncidentResponseDTO> getIncidentById(@PathVariable String incidentId) {
        return ResponseEntity.ok(incidentService.getIncidentById(incidentId));
    }

    @GetMapping("/reporter/{reporterId}")
    public ResponseEntity<List<IncidentResponseDTO>> getIncidentsByReporterId(@PathVariable String reporterId) {
        return ResponseEntity.ok(incidentService.getIncidentsByReporterId(reporterId));
    }

    @PatchMapping("/{incidentId}/status")
    public ResponseEntity<IncidentResponseDTO> updateIncidentStatus(@PathVariable String incidentId, @RequestBody Map<String, String> payload) {
        String newStatus = payload.get("status");
        String finalOutcome = payload.get("outcome");
        if (newStatus == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(incidentService.updateIncidentStatus(incidentId, newStatus, finalOutcome));
    }

    @PostMapping("/{incidentId}/dispatch")
    public ResponseEntity<String> dispatchAmbulance(@PathVariable String incidentId, @RequestParam String vehicleId) {
        try {
            dispatchLogService.dispatchAmbulance(incidentId, vehicleId);
            return ResponseEntity.ok("{\"status\":\"DISPATCHED\",\"incidentId\":\"" + incidentId + "\",\"vehicleId\":\"" + vehicleId + "\"}");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("{\"error\":\"" + e.getClass().getSimpleName() + "\",\"message\":\"" + e.getMessage().replace("\"", "'") + "\"}");
        }
    }
    
    @PatchMapping("/dispatch/{dispatchId}/complete")
    public ResponseEntity<Map<String, Object>> completeDispatch(@PathVariable String dispatchId) {
        DispatchLog log = dispatchLogService.completeDispatch(dispatchId);
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("dispatchId", log.getDispatchId());
        response.put("status", log.getStatus());
        response.put("completedAt", log.getCompletedAt());
        return ResponseEntity.ok(response);
    }
}
