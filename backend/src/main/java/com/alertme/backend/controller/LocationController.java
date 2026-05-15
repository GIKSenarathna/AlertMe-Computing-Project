package com.alertme.backend.controller;

import com.alertme.backend.model.Location;
import com.alertme.backend.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    @PostMapping
    public ResponseEntity<Location> saveLocation(@RequestBody Location location) {
        return new ResponseEntity<>(locationService.saveLocation(location), HttpStatus.CREATED);
    }

    @GetMapping("/{locationId}")
    public ResponseEntity<Location> getLocation(@PathVariable String locationId) {
        return locationService.getLocationById(locationId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
