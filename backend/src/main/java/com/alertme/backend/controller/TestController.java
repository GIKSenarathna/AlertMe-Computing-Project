package com.alertme.backend.controller;

import com.alertme.backend.repository.AmbulanceRepository;
import com.alertme.backend.repository.DispatchLogRepository;
import com.alertme.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class TestController {

    private final DispatchLogRepository dispatchLogRepository;
    private final IncidentRepository incidentRepository;
    private final AmbulanceRepository ambulanceRepository;



    @GetMapping("/api/test")
    public String getTest() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        return mapper.writeValueAsString(dispatchLogRepository.findByStatusIn(java.util.Arrays.asList("ASSIGNED", "ARRIVED", "EN_ROUTE", "ON_SCENE", "TRANSPORTING")));
    }

    @PostMapping("/api/admin/reset-dispatches")
    public Map<String, Object> resetDispatches() {
        Map<String, Object> result = new HashMap<>();

        // 1. Count before
        long dispatchCount = dispatchLogRepository.count();
        result.put("dispatchesDeleted", dispatchCount);

        // 2. Delete all dispatch logs first (child records)
        dispatchLogRepository.deleteAll();
        dispatchLogRepository.flush();

        // 3. Reset all incidents to REPORTED
        var allIncidents = incidentRepository.findAll();
        int incidentsReset = 0;
        for (var inc : allIncidents) {
            if (!"Resolved".equals(inc.getStatus())) {
                inc.setStatus("REPORTED");
                incidentsReset++;
            }
        }
        incidentRepository.saveAll(allIncidents);
        incidentRepository.flush();
        result.put("incidentsReset", incidentsReset);

        // 4. Reset all ambulances to AVAILABLE
        var allAmbs = ambulanceRepository.findAll();
        for (var amb : allAmbs) {
            amb.setCurrentStatus("AVAILABLE");
        }
        ambulanceRepository.saveAll(allAmbs);
        ambulanceRepository.flush();
        result.put("ambulancesReset", allAmbs.size());

        result.put("success", true);
        return result;
    }
}
