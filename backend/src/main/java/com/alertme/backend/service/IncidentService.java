package com.alertme.backend.service;

import com.alertme.backend.dto.IncidentRequestDTO;
import com.alertme.backend.dto.IncidentResponseDTO;
import com.alertme.backend.exception.ResourceNotFoundException;
import com.alertme.backend.model.Citizen;
import com.alertme.backend.model.Incident;
import com.alertme.backend.model.Location;
import com.alertme.backend.repository.AmbulanceRepository;
import com.alertme.backend.repository.CitizenRepository;
import com.alertme.backend.repository.DispatchLogRepository;
import com.alertme.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final CitizenRepository citizenRepository;
    private final AuthorityResponseService authorityResponseService;
    private final DispatchLogRepository dispatchLogRepository;
    private final AmbulanceRepository ambulanceRepository;

    @Transactional
    public IncidentResponseDTO reportIncident(IncidentRequestDTO dto) {
        Citizen reporter = citizenRepository.findById(dto.getReporterId())
                .orElseGet(() -> citizenRepository.findByPhoneNumber("ANONYMOUS")
                    .orElseGet(() -> {
                        Citizen anonymous = Citizen.builder()
                                .name("Emergency SOS / Anonymous Reporter")
                                .phoneNumber("ANONYMOUS")
                                .online(true)
                                .build();
                        return citizenRepository.save(anonymous);
                    })
                );

        Location location = Location.builder()
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .approximateAddress(dto.getApproximateAddress())
                .build();

        Incident incident = Incident.builder()
                .reporter(reporter)
                .location(location)
                .type(dto.getType())
                .severityScore(dto.getSeverityScore())
                // status and reportedAt handled natively by @PrePersist
                .build();

        Incident savedIncident = incidentRepository.save(incident);
        
        // Auto-generation hook: Initialize Fire and Police "PENDING" responses instantly
        authorityResponseService.initializeDefaultResponses(savedIncident);
        
        return mapToDTO(savedIncident);
    }

    public List<IncidentResponseDTO> getAllIncidents() {
        return incidentRepository.findAll()
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public List<IncidentResponseDTO> getActiveIncidents() {
        return incidentRepository.findByStatusNot("Resolved") 
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public IncidentResponseDTO getIncidentById(String incidentId) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new ResourceNotFoundException("Incident not found with ID: " + incidentId));
        return mapToDTO(incident);
    }

    public List<IncidentResponseDTO> getIncidentsByReporterId(String reporterId) {
        return incidentRepository.findByReporter_CitizenId(reporterId)
                .stream()
                .map(this::mapToDTO)
                .sorted((a, b) -> b.getReportedAt().compareTo(a.getReportedAt()))
                .collect(Collectors.toList());
    }

    @Transactional
    public IncidentResponseDTO updateIncidentStatus(String incidentId, String newStatus, String outcome) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new ResourceNotFoundException("Incident not found with ID: " + incidentId));

        incident.setStatus(newStatus);

        // When incident is resolved, free any linked ambulances back to AVAILABLE
        if (newStatus != null && newStatus.toLowerCase().contains("resolv")) {
            if (outcome != null && !outcome.trim().isEmpty()) {
                incident.setFinalOutcome(outcome);
            }
            
            var dispatches = dispatchLogRepository.findByIncident_IncidentId(incidentId);
            for (var dispatch : dispatches) {
                if (dispatch.getAmbulance() != null) {
                    var amb = dispatch.getAmbulance();
                    amb.setCurrentStatus("AVAILABLE");
                    // Reset ambulance location back to its station/home base
                    if (amb.getStationLocation() != null) {
                        Location stationReset = Location.builder()
                                .latitude(amb.getStationLocation().getLatitude())
                                .longitude(amb.getStationLocation().getLongitude())
                                .approximateAddress(amb.getStationLocation().getApproximateAddress())
                                .accuracyRadius(amb.getStationLocation().getAccuracyRadius())
                                .build();
                        amb.setCurrentLocation(stationReset);
                    }
                    ambulanceRepository.save(amb);
                    dispatch.setStatus("COMPLETED");
                    dispatchLogRepository.save(dispatch);
                }
            }
        } else {
            // Keep outcome clean if moved back to ACTIVE
            incident.setFinalOutcome(null);
        }

        Incident saved = incidentRepository.save(incident);
        return mapToDTO(saved);
    }

    public IncidentResponseDTO mapToDTO(Incident incident) {
        return IncidentResponseDTO.builder()
                .incidentId(incident.getIncidentId())
                .reporterId(incident.getReporter().getCitizenId())
                .reporterName(incident.getReporter().getName())
                .reporterPhone(incident.getReporter().getPhoneNumber())
                .latitude(incident.getLocation().getLatitude())
                .longitude(incident.getLocation().getLongitude())
                .approximateAddress(incident.getLocation().getApproximateAddress())
                .reportedAt(incident.getReportedAt())
                .type(incident.getType())
                .severityScore(incident.getSeverityScore())
                .status(incident.getStatus())
                .finalOutcome(incident.getFinalOutcome())
                .build();
    }
}
