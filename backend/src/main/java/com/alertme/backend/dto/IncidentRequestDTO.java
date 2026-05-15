package com.alertme.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class IncidentRequestDTO {
    
    @NotBlank(message = "Reporter ID cannot be blank")
    private String reporterId; // Will be extracted from JWT in production
    
    @NotBlank(message = "Incident type cannot be blank")
    private String type; // MEDICAL, FIRE, VEHICLE
    
    @Min(value = 1, message = "Severity score minimum is 1")
    @Max(value = 5, message = "Severity score maximum is 5")
    private int severityScore;
    
    private float latitude;
    private float longitude;
    private String approximateAddress;
}
