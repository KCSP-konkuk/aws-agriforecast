package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SignupRequest {
    
    private String username;  // 아이디
    private String password;  // 비밀번호
    private String fullname;  // 이름
    private String email;     // 이메일
}






