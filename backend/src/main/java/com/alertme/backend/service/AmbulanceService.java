package com.alertme.backend.service;

import java.time.LocalDateTime;

import com.alertme.backend.model.Ambulance;
import com.alertme.backend.model.Location;
import com.alertme.backend.repository.AmbulanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AmbulanceService {

    private final AmbulanceRepository ambulanceRepository;

    public Ambulance registerAmbulance(Ambulance ambulance) {
        if (ambulance.getCurrentStatus() == null) {
            ambulance.setCurrentStatus("AVAILABLE");
        }
        if (ambulance.getRegisteredAt() == null) {
            ambulance.setRegisteredAt(LocalDateTime.now());
        }
        ambulance.setActive(true);
        // Auto-assign coordinates based on station name if no GPS provided
        if (ambulance.getCurrentLocation() == null && ambulance.getStationName() != null) {
            float lat = 6.9271f; // Default Colombo
            float lng = 79.8612f;
            String st = ambulance.getStationName().toLowerCase();
            
            if (st.contains("kandy")) { lat = 7.2906f; lng = 80.6337f; }
            else if (st.contains("ratnapura")) { lat = 6.6828f; lng = 80.3992f; }
            else if (st.contains("galle")) { lat = 6.0535f; lng = 80.2210f; }
            else if (st.contains("jaffna")) { lat = 9.6615f; lng = 80.0255f; }
            else if (st.contains("kurunegala")) { lat = 7.4818f; lng = 80.3609f; }
            else if (st.contains("nawaloka")) { lat = 6.9150f; lng = 79.8580f; }
            else if (st.contains("negombo")) { lat = 7.2008f; lng = 79.8737f; }

            Location loc = Location.builder()
                    .latitude(lat)
                    .longitude(lng)
                    .approximateAddress(ambulance.getStationName())
                    .accuracyRadius(5.0f)
                    .build();
            ambulance.setCurrentLocation(loc);
        }

        // Persist the registration location as the permanent station location
        if (ambulance.getCurrentLocation() != null && ambulance.getStationLocation() == null) {
            Location station = Location.builder()
                    .latitude(ambulance.getCurrentLocation().getLatitude())
                    .longitude(ambulance.getCurrentLocation().getLongitude())
                    .approximateAddress(ambulance.getCurrentLocation().getApproximateAddress())
                    .accuracyRadius(ambulance.getCurrentLocation().getAccuracyRadius())
                    .build();
            ambulance.setStationLocation(station);
        }
        return ambulanceRepository.save(ambulance);
    }

    public List<Ambulance> getAvailableAmbulances() {
        return ambulanceRepository.findByCurrentStatus("AVAILABLE");
    }

    public List<Ambulance> getAllAmbulances() {
        return ambulanceRepository.findAll();
    }

    public Optional<Ambulance> getAmbulanceById(String vehicleId) {
        return ambulanceRepository.findById(vehicleId);
    }

    public Ambulance updateAmbulanceStatus(String vehicleId, String newStatus) {
        Ambulance ambulance = ambulanceRepository.findById(vehicleId)
                .orElseThrow(() -> new RuntimeException("Ambulance not found"));
        ambulance.setCurrentStatus(newStatus.toUpperCase());
        return ambulanceRepository.save(ambulance);
    }
}
