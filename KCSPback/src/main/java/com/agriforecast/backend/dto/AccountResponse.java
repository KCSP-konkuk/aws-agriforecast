package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 계정 관련 요청의 결과. field 는 실패 원인이 된 입력 칸 (없으면 null) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class AccountResponse {
    private boolean success;
    private String message;
    private String field;

    public static AccountResponse ok(String message) {
        return new AccountResponse(true, message, null);
    }

    public static AccountResponse fail(String message, String field) {
        return new AccountResponse(false, message, field);
    }
}
