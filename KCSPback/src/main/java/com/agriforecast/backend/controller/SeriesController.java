package com.agriforecast.backend.controller;

import com.agriforecast.backend.service.SeriesService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** 분석 작업대 — 통합 시계열 목록과 값 (배치가 모은 지표를 원래 주기 그대로) */
@RestController
@RequestMapping("/api/series")
public class SeriesController {

    private static final LocalDate EARLIEST = LocalDate.of(2000, 1, 1);

    private final SeriesService seriesService;

    public SeriesController(SeriesService seriesService) {
        this.seriesService = seriesService;
    }

    /** 고를 수 있는 지표 목록 */
    @GetMapping("/catalog")
    public List<Map<String, Object>> catalog() {
        return seriesService.catalog();
    }

    /** 고른 지표의 값. ids 는 쉼표로 구분, 1~{@value SeriesService#MAX_SERIES}개 */
    @GetMapping("/data")
    public ResponseEntity<?> data(@RequestParam(required = false) String ids,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        List<String> list = SeriesService.parseIds(ids);
        if (list.isEmpty() || list.size() > SeriesService.MAX_SERIES) {
            return ResponseEntity.badRequest().body(Map.of("message",
                    "지표를 1개에서 " + SeriesService.MAX_SERIES + "개까지 골라 주세요."));
        }
        LocalDate start = from == null ? EARLIEST : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        if (start.isAfter(end)) {
            return ResponseEntity.badRequest().body(Map.of("message", "시작일이 종료일보다 늦어요."));
        }
        return ResponseEntity.ok(seriesService.data(list, start, end));
    }
}
