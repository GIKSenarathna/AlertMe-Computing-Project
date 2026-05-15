package com.alertme.backend.service;

import com.alertme.backend.exception.ResourceNotFoundException;
import com.alertme.backend.model.Ambulance;
import com.alertme.backend.model.DispatchLog;
import com.alertme.backend.model.Incident;
import com.alertme.backend.repository.AmbulanceRepository;
import com.alertme.backend.repository.DispatchLogRepository;
import com.alertme.backend.repository.HospitalRepository;
import com.alertme.backend.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DispatchLogService {

    private final DispatchLogRepository dispatchLogRepository;
    private final IncidentRepository incidentRepository;
    private final AmbulanceRepository ambulanceRepository;
    private final HospitalRepository hospitalRepository;

    public DispatchLog createDispatch(DispatchLog dispatchLog) {
        return dispatchLogRepository.save(dispatchLog);
    }

    public DispatchLog dispatchAmbulance(String incidentId, String vehicleId) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new ResourceNotFoundException("Incident not found: " + incidentId));

        Ambulance ambulance = ambulanceRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Ambulance not found: " + vehicleId));

        if (!ambulance.getCurrentStatus().equals("AVAILABLE")) {
            throw new IllegalStateException("Ambulance is not available. Current status: " + ambulance.getCurrentStatus());
        }

        // 1. Update Incident
        incident.setStatus("Dispatched");
        incidentRepository.saveAndFlush(incident);

        // 2. Update Ambulance
        ambulance.setCurrentStatus("EN_ROUTE");
        ambulanceRepository.saveAndFlush(ambulance);

        // 3. Calculate real ETA using Haversine distance formula
        int etaSeconds = calculateEtaSeconds(ambulance, incident);

        // 4. Generate structured Dispatch Log
        DispatchLog log = DispatchLog.builder()
                .incident(incident)
                .ambulance(ambulance)
                .status("ASSIGNED")
                .estimatedEtaSeconds(etaSeconds)
                .build();

        return dispatchLogRepository.saveAndFlush(log);
    }

    @Transactional
    public DispatchLog completeDispatch(String dispatchId) {
        DispatchLog log = dispatchLogRepository.findById(dispatchId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispatch not found"));

        log.setStatus("COMPLETED");
        
        // Free the ambulance and return it to its home station
        Ambulance amb = log.getAmbulance();
        amb.setCurrentStatus("AVAILABLE");
        if (amb.getStationLocation() != null) {
            com.alertme.backend.model.Location stationReset = com.alertme.backend.model.Location.builder()
                    .latitude(amb.getStationLocation().getLatitude())
                    .longitude(amb.getStationLocation().getLongitude())
                    .approximateAddress(amb.getStationLocation().getApproximateAddress())
                    .accuracyRadius(amb.getStationLocation().getAccuracyRadius())
                    .build();
            amb.setCurrentLocation(stationReset);
        }
        ambulanceRepository.save(amb);
        
        // Close the incident naturally
        Incident incident = log.getIncident();
        incident.setStatus("Resolved");
        incidentRepository.save(incident);
        
        return dispatchLogRepository.save(log);
    }

    public List<DispatchLog> getDispatchesForIncident(String incidentId) {
        return dispatchLogRepository.findByIncident_IncidentId(incidentId);
    }

    public List<DispatchLog> getDispatchesForAmbulance(String vehicleId) {
        return dispatchLogRepository.findByAmbulance_VehicleId(vehicleId);
    }

    public List<DispatchLog> getDispatchById_list(String dispatchId) {
        return dispatchLogRepository.findByStatus(dispatchId);
    }

    public List<DispatchLog> getActiveDispatches() {
        return dispatchLogRepository.findByStatusIn(java.util.Arrays.asList("ASSIGNED", "ARRIVED", "EN_ROUTE", "ON_SCENE", "TRANSPORTING"));
    }

    public DispatchLog getDispatchById(String dispatchId) {
        return dispatchLogRepository.findById(dispatchId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispatch Log not found"));
    }

    @Transactional
    public DispatchLog updateDispatchStatus(String dispatchId, String newStatus) {
        DispatchLog log = dispatchLogRepository.findById(dispatchId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispatch Log not found: " + dispatchId));
        log.setStatus(newStatus);

        // Also update the ambulance's status to reflect its real-world state
        if ("ARRIVED".equals(newStatus) || "ON_SCENE".equals(newStatus)) {
            Ambulance amb = log.getAmbulance();
            if (amb != null) {
                amb.setCurrentStatus("ON_SCENE");
                
                // CRITICAL: Synchronize ambulance location to the incident location
                // so distance to the hospital is calculated from the scene, not the station.
                if (log.getIncident() != null && log.getIncident().getLocation() != null) {
                    if (amb.getCurrentLocation() == null) {
                        amb.setCurrentLocation(new com.alertme.backend.model.Location());
                    }
                    amb.getCurrentLocation().setLatitude(log.getIncident().getLocation().getLatitude());
                    amb.getCurrentLocation().setLongitude(log.getIncident().getLocation().getLongitude());
                }
                
                ambulanceRepository.save(amb);
            }
        }

        return dispatchLogRepository.save(log);
    }

    @Transactional
    public DispatchLog markTransporting(String dispatchId, String hospitalId) {
        DispatchLog log = dispatchLogRepository.findById(dispatchId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispatch Log not found: " + dispatchId));

        com.alertme.backend.model.Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found: " + hospitalId));

        log.setStatus("TRANSPORTING");
        log.setDestinationHospitalName(hospital.getName());
        log.setDestinationHospitalLat(hospital.getLatitude());
        log.setDestinationHospitalLng(hospital.getLongitude());
        log.setDestinationHospitalAddress(hospital.getAddress());

        // Update ambulance status
        Ambulance amb = log.getAmbulance();
        if (amb != null) {
            amb.setCurrentStatus("TRANSPORTING");
            ambulanceRepository.save(amb);
        }

        return dispatchLogRepository.save(log);
    }

    /**
     * Calculates estimated arrival time using the Haversine formula.
     * Assumes an average emergency speed of 60 km/h on Sri Lankan roads.
     * Falls back to 30 minutes if GPS coordinates are missing.
     */
    private int calculateEtaSeconds(Ambulance ambulance, Incident incident) {
        try {
            var ambulanceLoc = ambulance.getCurrentLocation();
            var incidentLoc = incident.getLocation();

            if (incidentLoc == null) {
                return 1800; // fallback: 30 minutes if we don't know where the incident is
            }

            double lat1 = ambulanceLoc != null ? ambulanceLoc.getLatitude() : 6.9271;
            double lon1 = ambulanceLoc != null ? ambulanceLoc.getLongitude() : 79.8612;
            double lat2 = incidentLoc.getLatitude();
            double lon2 = incidentLoc.getLongitude();

            // Haversine formula
            final double EARTH_RADIUS_KM = 6371.0;
            double dLat = Math.toRadians(lat2 - lat1);
            double dLon = Math.toRadians(lon2 - lon1);

            double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLon / 2) * Math.sin(dLon / 2);

            double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            double distanceKm = EARTH_RADIUS_KM * c;

            // Average emergency speed: 60 km/h on Sri Lankan roads
            double averageSpeedKmPerHour = 60.0;
            double timeHours = distanceKm / averageSpeedKmPerHour;
            int etaSeconds = (int) (timeHours * 3600);

            // Minimum 2 minutes even if very close
            return Math.max(etaSeconds, 120);

        } catch (Exception e) {
            return 1800; // fallback: 30 minutes on any error
        }
    }
}
