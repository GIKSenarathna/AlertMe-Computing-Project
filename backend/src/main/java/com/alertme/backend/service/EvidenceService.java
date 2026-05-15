package com.alertme.backend.service;

import com.alertme.backend.model.Evidence;
import com.alertme.backend.model.Incident;
import com.alertme.backend.repository.EvidenceRepository;
import com.alertme.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class EvidenceService {

    private final EvidenceRepository evidenceRepository;
    private final IncidentRepository incidentRepository;

    public Evidence uploadEvidence(Evidence evidence) {
        if (evidence.getIncident() != null && evidence.getIncident().getIncidentId() != null) {
            Incident actualIncident = incidentRepository.findById(evidence.getIncident().getIncidentId())
                    .orElseThrow(() -> new RuntimeException("Incident not found: " + evidence.getIncident().getIncidentId()));
            evidence.setIncident(actualIncident);
        }
        return evidenceRepository.save(evidence);
    }

    public Evidence uploadEvidenceForIncident(String incidentId, Evidence evidence) {
        Incident actualIncident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new RuntimeException("Incident not found: " + incidentId));
        evidence.setIncident(actualIncident);
        return evidenceRepository.save(evidence);
    }

    public List<Evidence> getEvidenceForIncident(String incidentId) {
        return evidenceRepository.findByIncident_IncidentId(incidentId);
    }

    public Optional<Evidence> getEvidenceById(String evidenceId) {
        return evidenceRepository.findById(evidenceId);
    }
    
    public void deleteEvidence(String evidenceId) {
        evidenceRepository.deleteById(evidenceId);
    }
}
