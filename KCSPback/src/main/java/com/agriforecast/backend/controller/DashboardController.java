package com.agriforecast.backend.controller;

import com.agriforecast.backend.service.DashboardService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 대시보드 탭 — 품목별 가격 인사이트(배치가 계산한 JSON)를 그대로 내려준다 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    /** 인사이트가 있는 품목 목록 */
    @GetMapping("/items")
    public List<Map<String, Object>> items() {
        return dashboardService.listItems();
    }

    /** 품목 인사이트. 아직 계산 전이면 404 */
    @GetMapping
    public ResponseEntity<String> insight(@RequestParam String item) {
        return dashboardService.findPayload(item)
                .map(payload -> ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(payload))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
