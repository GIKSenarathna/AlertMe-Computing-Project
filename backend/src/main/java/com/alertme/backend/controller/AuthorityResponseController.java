package com.alertme.backend.controller;

import com.alertme.backend.model.AuthorityResponse;
import com.alertme.backend.model.Incident;
import com.alertme.backend.repository.IncidentRepository;
import com.alertme.backend.service.AuthorityResponseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthorityResponseController {

    private final AuthorityResponseService authorityResponseService;
    private final IncidentRepository incidentRepository;

    // Fetch all authority tracks for a single incident
    @GetMapping("/incidents/{incidentId}/authority-response")
    public ResponseEntity<List<AuthorityResponse>> getResponsesForIncident(@PathVariable String incidentId) {
        return ResponseEntity.ok(authorityResponseService.getResponsesForIncident(incidentId));
    }

    // Fetch all active authority tracks globally (for the main dashboard)
    @GetMapping("/authority-response/active")
    public ResponseEntity<List<AuthorityResponse>> getActiveAuthorityResponses() {
        return ResponseEntity.ok(authorityResponseService.getActiveAuthorityResponses());
    }

    // Initialize default FIRE + POLICE authority responses for an existing incident
    @PostMapping("/incidents/{incidentId}/authority-response/initialize")
    public ResponseEntity<List<AuthorityResponse>> initializeResponses(@PathVariable String incidentId) {
        List<AuthorityResponse> existing = authorityResponseService.getResponsesForIncident(incidentId);
        if (!existing.isEmpty()) {
            return ResponseEntity.ok(existing); // Already initialized
        }
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new com.alertme.backend.exception.ResourceNotFoundException("Incident not found: " + incidentId));
        authorityResponseService.initializeDefaultResponses(incident);
        return ResponseEntity.ok(authorityResponseService.getResponsesForIncident(incidentId));
    }

    // Dispatcher updates the status of a specific response ping
    @PatchMapping("/authority-response/{responseId}/status")
    public ResponseEntity<AuthorityResponse> updateStatus(
            @PathVariable String responseId, 
            @RequestBody Map<String, String> payload) {
            
        String status = payload.get("status");
        String dispatcherId = payload.get("dispatcherId"); // completely optional traceability
        
        if (status == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(authorityResponseService.updateResponseStatus(responseId, status, dispatcherId));
    }
}
