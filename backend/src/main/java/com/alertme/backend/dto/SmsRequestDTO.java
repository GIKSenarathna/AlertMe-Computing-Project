package com.alertme.backend.dto;

import java.util.List;

public class SmsRequestDTO {
    private List<String> toNumbers;
    private String message;

    public SmsRequestDTO() {}

    public SmsRequestDTO(List<String> toNumbers, String message) {
        this.toNumbers = toNumbers;
        this.message = message;
    }

    public List<String> getToNumbers() {
        return toNumbers;
    }

    public void setToNumbers(List<String> toNumbers) {
        this.toNumbers = toNumbers;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
