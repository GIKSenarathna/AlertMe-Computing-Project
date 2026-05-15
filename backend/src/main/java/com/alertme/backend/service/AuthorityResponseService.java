package com.alertme.backend.service;

import com.alertme.backend.model.AuthorityResponse;
import com.alertme.backend.model.Incident;
import com.alertme.backend.repository.AuthorityResponseRepository;
import com.alertme.backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthorityResponseService {

    private final AuthorityResponseRepository authorityResponseRepository;

    public List<AuthorityResponse> getResponsesForIncident(String incidentId) {
        return authorityResponseRepository.findByIncident_IncidentId(incidentId);
    }

    public List<AuthorityResponse> getActiveAuthorityResponses() {
        return authorityResponseRepository.findActiveOrIncompleteResponses();
    }

    public AuthorityResponse updateResponseStatus(String responseId, String newStatus, String dispatcherId) {
        AuthorityResponse response = authorityResponseRepository.findById(responseId)
                .orElseThrow(() -> new ResourceNotFoundException("AuthorityResponse not found with ID: " + responseId));

        response.setStatus(newStatus.toUpperCase());
        if (dispatcherId != null && !dispatcherId.isEmpty()) {
            response.setAcknowledgedBy(dispatcherId);
        }
        
        return authorityResponseRepository.save(response);
    }

    public void initializeDefaultResponses(Incident incident) {
        // Automatically create PENDING responses for primary authorities
        AuthorityResponse fireResponse = AuthorityResponse.builder()
                .incident(incident)
                .authorityType("FIRE")
                .status("PENDING")
                .build();

        AuthorityResponse policeResponse = AuthorityResponse.builder()
                .incident(incident)
                .authorityType("POLICE")
                .status("PENDING")
                .build();

        authorityResponseRepository.saveAll(List.of(fireResponse, policeResponse));
    }
}
