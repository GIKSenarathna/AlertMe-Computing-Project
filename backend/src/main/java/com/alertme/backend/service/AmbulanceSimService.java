package com.alertme.backend.service;

import com.alertme.backend.model.Ambulance;
import com.alertme.backend.model.DispatchLog;
import com.alertme.backend.model.Location;
import com.alertme.backend.repository.AmbulanceRepository;
import com.alertme.backend.repository.DispatchLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AmbulanceSimService {

    private final DispatchLogRepository dispatchLogRepository;
    private final AmbulanceRepository ambulanceRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Simulation tick: Runs every 3 seconds to move active ambulances.
     */
    // Disabled backend simulation to allow frontend/mobile apps to manage their own real-time simulation speeds.
    // @Scheduled(fixedRate = 3000)
    @Transactional
    public void simulateMovements() {
        // Only simulate ambulances currently "ASSIGNED" to an incident
        List<DispatchLog> activeDispatches = dispatchLogRepository.findByStatus("ASSIGNED");
        
        if (activeDispatches.isEmpty()) return;

        for (DispatchLog dispatch : activeDispatches) {
            Ambulance ambulance = dispatch.getAmbulance();
            if (ambulance == null || ambulance.getCurrentLocation() == null) continue;

            Location current = ambulance.getCurrentLocation();
            Location target = dispatch.getIncident().getLocation();

            if (target == null) continue;

            // Simple linear interpolation for simulation (10% closer each tick)
            float stepScale = 0.10f; 
            float newLat = current.getLatitude() + (target.getLatitude() - current.getLatitude()) * stepScale;
            float newLon = current.getLongitude() + (target.getLongitude() - current.getLongitude()) * stepScale;

            // Check if arrived (within ~50 meters roughly)
            double distance = Math.sqrt(Math.pow(target.getLatitude() - newLat, 2) + Math.pow(target.getLongitude() - newLon, 2));
            
            if (distance < 0.0005) { // Threshold for arrival
                log.info("Ambulance {} has arrived at scenario scene.", ambulance.getVehicleId());
                newLat = target.getLatitude();
                newLon = target.getLongitude();
                dispatch.setStatus("ARRIVED");
                ambulance.setCurrentStatus("ON_SCENE");
                dispatchLogRepository.save(dispatch);
            }

            // Update local state
            current.setLatitude(newLat);
            current.setLongitude(newLon);
            
            // Persist & Broadcast
            ambulanceRepository.save(ambulance);
            
            // Broadcast the entire ambulance object (or a DTO) to the frontend
            messagingTemplate.convertAndSend("/topic/ambulances", ambulance);
        }
    }
}
