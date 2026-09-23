package com.agriforecast.backend.controller;

import com.agriforecast.backend.entity.SearchTrend;
import com.agriforecast.backend.service.NaverDataLabService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trend")
@CrossOrigin(origins = "http://localhost:5173")
public class SearchTrendController {

    private static final List<String> DEFAULT_KEYWORDS = List.of("배추", "양파", "양배추", "당근");

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

    // 검색 트렌드 수집(백필)
    // POST /api/trend/collect[?keyword=양배추][&endDate=2026-09-22]
    // keyword 생략 시 기본 4개 품목 전체. 항상 2016-01-01 부터 endDate(생략 시 어제)까지 한 번에 받아 덮어쓴다.
    // 기간을 나눠 받으면 데이터랩 정규화 기준이 구간마다 달라지므로 시작일은 받지 않는다.
    @PostMapping("/collect")
    public ResponseEntity<Map<String, Object>> collectTrends(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        List<String> keywords = (keyword == null || keyword.isBlank())
                ? DEFAULT_KEYWORDS
                : List.of(keyword);
        LocalDate end = endDate != null ? endDate : LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1);

        Map<String, Object> saved = new LinkedHashMap<>();
        for (String kw : keywords) {
            try {
                saved.put(kw, naverDataLabService.refreshSeries(kw, end).toString());
            } catch (Exception e) {
                saved.put(kw, "실패: " + e.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startDate", NaverDataLabService.SERIES_START.toString());
        result.put("endDate", end.toString());
        result.put("saved", saved);
        return ResponseEntity.ok(result);
    }
}
