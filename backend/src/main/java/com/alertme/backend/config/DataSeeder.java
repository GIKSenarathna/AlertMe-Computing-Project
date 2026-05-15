package com.alertme.backend.config;

import com.alertme.backend.model.Ambulance;
import com.alertme.backend.model.Dispatcher;
import com.alertme.backend.model.Location;
import com.alertme.backend.repository.AmbulanceRepository;
import com.alertme.backend.repository.DispatcherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

@Configuration
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final DispatcherRepository dispatcherRepository;
    private final AmbulanceRepository ambulanceRepository;

    @Override
    public void run(String... args) throws Exception {
        // Automatically inject a default Master Admin so the React Dashboard can actually be logged into
            if (dispatcherRepository.findByPhoneNumber("admin@alertme.lk").isEmpty()) {
                Dispatcher admin = Dispatcher.builder()
                        .name("Master Dispatcher (Admin)")
                        .phoneNumber("admin@alertme.lk") // Mapped to phoneNumber column for login simplicity
                        .languageCode("EN")
                        .online(true)
                        .accessLevel("ADMIN")
                        .build();
                dispatcherRepository.save(admin);
            } else {
                // Migrate old role if still set to SUPER_ADMIN or DISPATCHER
                dispatcherRepository.findByPhoneNumber("admin@alertme.lk").ifPresent(existing -> {
                    if ("SUPER_ADMIN".equals(existing.getAccessLevel()) || "DISPATCHER".equals(existing.getAccessLevel())) {
                        existing.setAccessLevel("ADMIN");
                        dispatcherRepository.save(existing);
                        System.out.println("✅ Migrated admin@alertme.lk role from " + existing.getAccessLevel() + " → ADMIN");
                    }
                });
            }

            if (dispatcherRepository.findByPhoneNumber("medical@alertme.lk").isEmpty()) {
                Dispatcher medical = Dispatcher.builder()
                        .name("Medical Authority")
                        .phoneNumber("medical@alertme.lk")
                        .languageCode("EN")
                        .online(true)
                        .accessLevel("MEDICAL")
                        .build();
                dispatcherRepository.save(medical);
            }

            if (dispatcherRepository.findByPhoneNumber("fire@alertme.lk").isEmpty()) {
                Dispatcher fire = Dispatcher.builder()
                        .name("Fire Service Authority")
                        .phoneNumber("fire@alertme.lk")
                        .languageCode("EN")
                        .online(true)
                        .accessLevel("FIRE")
                        .build();
                dispatcherRepository.save(fire);
            }

            if (dispatcherRepository.findByPhoneNumber("police@alertme.lk").isEmpty()) {
                Dispatcher police = Dispatcher.builder()
                        .name("Law Enforcement Authority")
                        .phoneNumber("police@alertme.lk")
                        .languageCode("EN")
                        .online(true)
                        .accessLevel("POLICE")
                        .build();
                dispatcherRepository.save(police);
            }

            if (dispatcherRepository.findByPhoneNumber("+94771234567").isEmpty()) {
                Dispatcher mobileUser = Dispatcher.builder()
                        .name("Mobile App Tester")
                        .phoneNumber("+94771234567")
                        .languageCode("EN")
                        .online(false)
                        .accessLevel("CITIZEN")
                        .build();
                dispatcherRepository.save(mobileUser);
            }
            
            System.out.println("✅ DEFAULT DASHBOARD TEST ACCOUNTS GENERATED OR VERIFIED!");
            System.out.println("👉 Admin: admin@alertme.lk");
            System.out.println("👉 Medical: medical@alertme.lk");
            System.out.println("👉 Fire: fire@alertme.lk");
            System.out.println("👉 Police: police@alertme.lk");
            System.out.println("   (Ensure these are registered in Firebase Auth)");

        // Automatically inject a default Fleet so the UI map markers show up
        if (ambulanceRepository.count() == 0) {
            Ambulance a1 = Ambulance.builder()
                    .vehicleId("AMB-WP-001")
                    .crewName("Rapid Response Alpha")
                    .capabilityType("ICU")
                    .currentStatus("AVAILABLE")
                    .driverPhone("+94770001111")
                    .licensePlate("WP KV-1234")
                    .stationName("Colombo General")
                    .currentLocation(Location.builder().latitude(6.9271f).longitude(79.8612f).approximateAddress("Colombo General Hospital").accuracyRadius(5.0f).build())
                    .stationLocation(Location.builder().latitude(6.9271f).longitude(79.8612f).approximateAddress("Colombo General Hospital").accuracyRadius(5.0f).build())
                    .active(true)
                    .build();

            Ambulance a2 = Ambulance.builder()
                    .vehicleId("AMB-WP-002")
                    .crewName("Medical Team Bravo")
                    .capabilityType("Advanced")
                    .currentStatus("EN_ROUTE")
                    .driverPhone("+94770002222")
                    .licensePlate("WP NA-5566")
                    .stationName("Nawaloka Hospital")
                    .currentLocation(Location.builder().latitude(6.9150f).longitude(79.8580f).approximateAddress("Nawaloka Hospital Area").accuracyRadius(5.0f).build())
                    .stationLocation(Location.builder().latitude(6.9150f).longitude(79.8580f).approximateAddress("Nawaloka Hospital Area").accuracyRadius(5.0f).build())
                    .active(true)
                    .build();

            Ambulance a3 = Ambulance.builder()
                    .vehicleId("AMB-WP-003")
                    .crewName("Paramedic Unit 7")
                    .capabilityType("Basic")
                    .currentStatus("AVAILABLE")
                    .driverPhone("+94770003333")
                    .licensePlate("WP BQ-9988")
                    .stationName("Kandy Station")
                    .currentLocation(Location.builder().latitude(7.2906f).longitude(80.6337f).approximateAddress("Kandy Central").accuracyRadius(10.0f).build())
                    .stationLocation(Location.builder().latitude(7.2906f).longitude(80.6337f).approximateAddress("Kandy Central").accuracyRadius(10.0f).build())
                    .active(true)
                    .build();

            ambulanceRepository.saveAll(java.util.List.of(a1, a2, a3));
            System.out.println("🚑 DEFAULT AMBULANCE FLEET GENERATED!");
        } else {
            // Backfill missing locations and stationLocations for existing ambulances
            java.util.List<Ambulance> existing = ambulanceRepository.findAll();
            for (Ambulance a : existing) {
                boolean changed = false;
                float lat = 6.9271f, lng = 79.8612f;
                String addr = "Colombo General Hospital";
                
                String st = (a.getStationName() != null) ? a.getStationName().toLowerCase() : "";
                if (a.getVehicleId().endsWith("002") || st.contains("nawaloka")) { lat = 6.9150f; lng = 79.8580f; addr = "Nawaloka Hospital Area"; }
                else if (a.getVehicleId().endsWith("003") || st.contains("kandy")) { lat = 7.2906f; lng = 80.6337f; addr = "Kandy Central"; }
                else if (st.contains("ratnapura")) { lat = 6.6828f; lng = 80.3992f; addr = "Ratnapura Station"; }
                else if (st.contains("galle")) { lat = 6.0535f; lng = 80.2210f; addr = "Galle Station"; }

                // Always override and correct the location based on stationName, even if it was previously set incorrectly
                if (a.getCurrentLocation() == null || Math.abs(a.getCurrentLocation().getLatitude() - lat) > 0.01) {
                    Location newLoc = Location.builder().latitude(lat).longitude(lng).approximateAddress(addr).accuracyRadius(5.0f).build();
                    if (a.getCurrentLocation() != null) {
                        newLoc.setLocationId(a.getCurrentLocation().getLocationId());
                    }
                    a.setCurrentLocation(newLoc);
                    changed = true;
                }
                
                if (a.getStationLocation() == null || Math.abs(a.getStationLocation().getLatitude() - lat) > 0.01) {
                    Location newStationLoc = Location.builder().latitude(lat).longitude(lng).approximateAddress(addr).accuracyRadius(5.0f).build();
                    if (a.getStationLocation() != null) {
                        newStationLoc.setLocationId(a.getStationLocation().getLocationId());
                    }
                    a.setStationLocation(newStationLoc);
                    changed = true;
                }
                
                if (changed) {
                    ambulanceRepository.save(a);
                    System.out.println("🚑 FORCED UPDATE station/location for: " + a.getVehicleId());
                }
            }
        }
    }
}
