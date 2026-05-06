package com.agriforecast.backend.controller;

import com.agriforecast.backend.entity.SearchTrend;
import com.agriforecast.backend.service.NaverDataLabService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/trend")
@CrossOrigin(origins = "http://localhost:5173")
public class SearchTrendController {

    private final NaverDataLabService naverDataLabService;

    public SearchTrendController(NaverDataLabService naverDataLabService) {
        this.naverDataLabService = naverDataLabService;
    }

    // 저장된 검색 트렌드 조회
    // GET /api/trend?keyword=양배추&startDate=2024-01-01&endDate=2024-12-31
    @GetMapping
    public ResponseEntity<List<SearchTrend>> getTrends(
            @RequestParam String keyword,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<SearchTrend> trends = naverDataLabService.getTrends(keyword, startDate, endDate);
        return ResponseEntity.ok(trends);
    }
}
