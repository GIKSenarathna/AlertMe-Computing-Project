package com.alertme.backend.controller;

import com.alertme.backend.model.DispatchLog;
import com.alertme.backend.service.DispatchLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dispatch-logs")
@RequiredArgsConstructor
public class DispatchLogController {

    private final DispatchLogService dispatchLogService;

    @PostMapping
    public ResponseEntity<DispatchLog> createDispatch(@RequestBody DispatchLog dispatchLog) {
        return new ResponseEntity<>(dispatchLogService.createDispatch(dispatchLog), HttpStatus.CREATED);
    }

    @GetMapping("/active")
    public ResponseEntity<List<DispatchLog>> getActiveDispatches() {
        return ResponseEntity.ok(dispatchLogService.getActiveDispatches());
    }

    @GetMapping("/incident/{incidentId}")
    public ResponseEntity<List<DispatchLog>> getDispatchesByIncident(@PathVariable String incidentId) {
        return ResponseEntity.ok(dispatchLogService.getDispatchesForIncident(incidentId));
    }

    @GetMapping("/ambulance/{vehicleId}")
    public ResponseEntity<List<DispatchLog>> getDispatchesByAmbulance(@PathVariable String vehicleId) {
        return ResponseEntity.ok(dispatchLogService.getDispatchesForAmbulance(vehicleId));
    }

    @PatchMapping("/{dispatchId}/status")
    public ResponseEntity<DispatchLog> updateDispatchStatus(
            @PathVariable String dispatchId,
            @RequestBody java.util.Map<String, String> body) {
        return ResponseEntity.ok(dispatchLogService.updateDispatchStatus(dispatchId, body.get("status")));
    }

    @PatchMapping("/{dispatchId}/transport")
    public ResponseEntity<DispatchLog> markTransporting(
            @PathVariable String dispatchId,
            @RequestParam String hospitalId) {
        return ResponseEntity.ok(dispatchLogService.markTransporting(dispatchId, hospitalId));
    }

    @GetMapping("/debug-active")
    public ResponseEntity<List<DispatchLog>> debugActiveDispatches() {
        return ResponseEntity.ok(dispatchLogService.getActiveDispatches());
    }

    @GetMapping("/{dispatchId}")
    public ResponseEntity<DispatchLog> getDispatchById(@PathVariable String dispatchId) {
        return ResponseEntity.ok(dispatchLogService.getDispatchById(dispatchId));
    }
}
