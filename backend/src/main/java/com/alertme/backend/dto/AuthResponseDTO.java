package com.alertme.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponseDTO {
    private String token;
    private String role; // CITIZEN or DISPATCHER
    private String userId; // UUID identifier
    private String name;
}
