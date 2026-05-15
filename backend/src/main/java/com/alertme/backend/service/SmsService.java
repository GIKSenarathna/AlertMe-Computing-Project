package com.alertme.backend.service;

import com.alertme.backend.dto.SmsRequestDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class SmsService {
    
    private static final Logger logger = LoggerFactory.getLogger(SmsService.class);

    public void sendSms(SmsRequestDTO request) {
        if (request.getToNumbers() == null || request.getToNumbers().isEmpty()) {
            logger.warn("SMS dispatch failed: No recipient numbers provided.");
            return;
        }

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        for (String number : request.getToNumbers()) {
            // Simulated delay for realistic behavior
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            System.out.println("\n===== SMS DISPATCH =====");
            System.out.println("Time:   " + timestamp);
            System.out.println("To:     " + number);
            System.out.println("Message:\n" + request.getMessage());
            System.out.println("Status: SUCCESS");
            System.out.println("========================\n");
            
            logger.info("Simulated SMS successfully dispatched to {}", number);
        }
    }
}
