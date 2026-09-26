package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SignupResponse {
    
    private boolean success;
    private String message;
    private String field;  // 실패 원인이 된 입력 칸 (username·fullname·email·password), 없으면 null

    public SignupResponse(boolean success, String message) {
        this(success, message, null);
    }
}






