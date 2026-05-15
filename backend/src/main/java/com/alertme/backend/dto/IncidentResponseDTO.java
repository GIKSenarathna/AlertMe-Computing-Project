package com.alertme.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class IncidentResponseDTO {
    private String incidentId;
    private String reporterId;
    private String reporterName;
    private String reporterPhone;
    private float latitude;
    private float longitude;
    private String approximateAddress;
    private LocalDateTime reportedAt;
    private String type;
    private int severityScore;
    private String status;
    private String finalOutcome;
}
