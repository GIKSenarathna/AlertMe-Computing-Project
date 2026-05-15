package com.alertme.backend.controller;

import com.alertme.backend.dto.SmsRequestDTO;
import com.alertme.backend.service.SmsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sms")
public class SmsController {

    private final SmsService smsService;

    @Autowired
    public SmsController(SmsService smsService) {
        this.smsService = smsService;
    }

    @PostMapping("/send")
    public ResponseEntity<?> sendSms(@RequestBody SmsRequestDTO request) {
        try {
            smsService.sendSms(request);
            return ResponseEntity.ok(Map.of("message", "SMS dispatched successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
