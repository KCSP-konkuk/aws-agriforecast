package com.agriforecast.backend.controller;

import com.agriforecast.backend.service.HomeService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 홈 화면 — 배치가 계산한 질문 · 답 · 차트 값과 오늘의 시장 칸(JSON)을 그대로 내려준다 */
@RestController
public class HomeController {

    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    /** 아직 계산 전이면 404 — 화면은 그 구역만 숨긴다 */
    @GetMapping("/api/home")
    public ResponseEntity<String> home() {
        return homeService.findPayload()
                .map(payload -> ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(payload))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
