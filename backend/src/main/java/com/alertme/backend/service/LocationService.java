package com.alertme.backend.service;

import com.alertme.backend.model.Location;
import com.alertme.backend.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;

    public Location saveLocation(Location location) {
        return locationRepository.save(location);
    }

    public Optional<Location> getLocationById(String id) {
        return locationRepository.findById(id);
    }
}
