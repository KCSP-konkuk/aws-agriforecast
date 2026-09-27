package com.agriforecast.backend.service;

/** 비밀번호 재설정 코드 메일 발송. 테스트에서는 가짜로 바꿔 끼운다 */
public interface ResetMailSender {

    /** 메일 서버 설정(spring.mail.*)이 되어 있는지 */
    boolean available();

    void send(String to, String subject, String body);
}
