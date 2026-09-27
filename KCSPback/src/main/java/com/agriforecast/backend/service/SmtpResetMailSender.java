package com.agriforecast.backend.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * spring.mail.host 등이 application-secret.properties 에 있을 때만 JavaMailSender 가 만들어진다.
 * 없으면 available()=false — 재설정 화면이 "메일 발송 준비 중"으로 안내한다
 */
@Component
public class SmtpResetMailSender implements ResetMailSender {

    private final ObjectProvider<JavaMailSender> mailSender;
    private final String from;

    public SmtpResetMailSender(ObjectProvider<JavaMailSender> mailSender,
                               @Value("${app.mail.from:${spring.mail.username:}}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public boolean available() {
        return mailSender.getIfAvailable() != null && !from.isBlank();
    }

    @Override
    public void send(String to, String subject, String body) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(body);
        mailSender.getObject().send(msg);
    }
}
