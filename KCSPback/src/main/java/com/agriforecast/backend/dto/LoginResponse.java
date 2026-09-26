package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {
    
    private boolean success;
    private String message;
    private UserInfo user;
    private String token;  // 로그인 성공 시 발급하는 JWT

    public LoginResponse(boolean success, String message, UserInfo user) {
        this(success, message, user, null);
    }
    
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Integer seqNoA010;
        private String id;
        private String name;
        private String email;
    }
}







