package com.agriforecast.backend.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 비밀번호 해시 생성 유틸리티
 * 
 * 사용 방법:
 * 1. 이 클래스를 실행하여 비밀번호 해시 생성
 * 2. 생성된 해시를 데이터베이스에 저장
 * 
 * 예시:
 * public static void main(String[] args) {
 *     PasswordHashGenerator generator = new PasswordHashGenerator();
 *     String hash = generator.hashPassword("test1234");
 *     System.out.println("해시: " + hash);
 * }
 */
public class PasswordHashGenerator {
    
    private final PasswordEncoder passwordEncoder;
    
    public PasswordHashGenerator() {
        this.passwordEncoder = new BCryptPasswordEncoder();
    }
    
    /**
     * 비밀번호를 BCrypt로 해시화
     * @param password 원본 비밀번호
     * @return 해시된 비밀번호
     */
    public String hashPassword(String password) {
        return passwordEncoder.encode(password);
    }
    
    /**
     * 비밀번호 검증
     * @param rawPassword 원본 비밀번호
     * @param encodedPassword 해시된 비밀번호
     * @return 일치 여부
     */
    public boolean matches(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }
    
    /**
     * 테스트용 메인 메서드
     * 실행하면 "test1234" 비밀번호의 해시를 출력합니다.
     */
    public static void main(String[] args) {
        PasswordHashGenerator generator = new PasswordHashGenerator();
        
        // 테스트 비밀번호 해시 생성
        String password = "test1234";
        String hash = generator.hashPassword(password);
        
        System.out.println("========================================");
        System.out.println("비밀번호: " + password);
        System.out.println("해시: " + hash);
        System.out.println("========================================");
        System.out.println();
        System.out.println("SQL에 사용할 값:");
        System.out.println("'" + hash + "'");
        System.out.println();
        System.out.println("검증 테스트:");
        boolean matches = generator.matches(password, hash);
        System.out.println("비밀번호 일치: " + matches);
    }
}







