package com.agriforecast.backend.controller;

import com.agriforecast.backend.service.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * 외부 API 데이터 수집 컨트롤러
 * 모든 수집 작업은 POST 요청으로 수동 트리거
 */
@RestController
@RequestMapping("/api/collect")
@CrossOrigin(origins = "http://localhost:5173")
public class DataCollectController {

    private final NongnetService nongnetService;
    private final OilPriceCollectService oilPriceCollectService;
    private final SupplyCollectService supplyCollectService;
    private final KosisService kosisService;
    private final ExchangeRateCollectService exchangeRateCollectService;
    private final StationWeatherCollectService stationWeatherCollectService;

    public DataCollectController(NongnetService nongnetService,
                                  SupplyCollectService supplyCollectService,
                                  OilPriceCollectService oilPriceCollectService,
                                  KosisService kosisService,
                                  ExchangeRateCollectService exchangeRateCollectService,
                                  StationWeatherCollectService stationWeatherCollectService) {
        this.nongnetService = nongnetService;
        this.supplyCollectService = supplyCollectService;
        this.oilPriceCollectService = oilPriceCollectService;
        this.kosisService = kosisService;
        this.exchangeRateCollectService = exchangeRateCollectService;
        this.stationWeatherCollectService = stationWeatherCollectService;
    }

    /**
     * 특정 연월 전체 데이터 일괄 수집
     * POST /api/collect/all?year=2024&month=1
     */
    @PostMapping("/all")
    public ResponseEntity<Map<String, Object>> collectAll(
            @RequestParam int year,
            @RequestParam int month) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            result.put("nongnet_price", nongnetService.collectPriceByYearMonth(year, month));
            result.put("nongnet_supply", supplyCollectService.collectByYearMonth(year, month));
            result.put("oil_price", oilPriceCollectService.collectByYearMonth(year, month));
            result.put("exchange_rate", exchangeRateCollectService.collectByYearMonth(year, month));
            result.put("status", "success");
        } catch (Exception e) {
            result.put("status", "error");
            result.put("error", e.getMessage());
        }
        return ResponseEntity.ok(result);
    }

    /**
     * 농넷(Nongnet) 가격 크롤링 (배추/양파/양배추/당근) - 백그라운드 비동기 실행
     * POST /api/collect/nongnet/price?year=2024&month=1
     */
    @PostMapping("/nongnet/price")
    public ResponseEntity<Map<String, Object>> collectNongnetPrice(
            @RequestParam int year, @RequestParam int month) {
        CompletableFuture.runAsync(() -> nongnetService.collectPriceByYearMonth(year, month));
        return ResponseEntity.ok(Map.of("status", "started", "year", year, "month", month,
                "message", "백그라운드에서 수집 중입니다. 서버 로그를 확인하세요."));
    }

    /**
     * 가락시장 반입량 수집
     * POST /api/collect/nongnet/supply?year=2024&month=1
     */
    @PostMapping("/nongnet/supply")
    public ResponseEntity<Map<String, Object>> collectNongnetSupply(
            @RequestParam int year, @RequestParam int month) {
        CompletableFuture.runAsync(() -> supplyCollectService.collectByYearMonth(year, month));
        return ResponseEntity.ok(Map.of("status", "started", "year", year, "month", month,
                "message", "백그라운드에서 수집 중입니다. 서버 로그를 확인하세요."));
    }

    /**
     * 가락시장 반입량 날짜 범위 수집
     * POST /api/collect/nongnet/supply/range?startDate=2021-01-01&endDate=2026-04-07
     */
    @PostMapping("/nongnet/supply/range")
    public ResponseEntity<Map<String, Object>> collectNongnetSupplyByRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        CompletableFuture.runAsync(() -> supplyCollectService.collectByDateRange(startDate, endDate));
        return ResponseEntity.ok(Map.of(
                "status", "started",
                "startDate", startDate.toString(),
                "endDate", endDate.toString(),
                "message", "백그라운드에서 수집 중입니다. 서버 로그를 확인하세요."
        ));
    }

    /**
     * 유가 수집 (오피넷 전국 주유소 평균가격)
     * POST /api/collect/oil
     */
    @PostMapping("/oil")
    public ResponseEntity<Map<String, Object>> collectOil() {
        int saved = oilPriceCollectService.collectCurrent();
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    /**
     * 환율 수집
     * POST /api/collect/exchange?year=2024&month=1
     */
    @PostMapping("/exchange")
    public ResponseEntity<Map<String, Object>> collectExchange(
            @RequestParam int year, @RequestParam int month) {
        int saved = exchangeRateCollectService.collectByYearMonth(year, month);
        return ResponseEntity.ok(Map.of("saved", saved, "year", year, "month", month));
    }

    /**
     * 환율 일별 수집 - 오늘
     * POST /api/collect/exchange/daily
     */
    @PostMapping("/exchange/daily")
    public ResponseEntity<Map<String, Object>> collectExchangeToday() {
        boolean saved = exchangeRateCollectService.collectToday();
        return ResponseEntity.ok(Map.of("saved", saved, "date", LocalDate.now().toString()));
    }

    /**
     * 환율 일별 수집 - 날짜 범위 (과거 데이터 채우기용)
     * POST /api/collect/exchange/daily/range?startDate=2024-01-01&endDate=2024-12-31
     */
    @PostMapping("/exchange/daily/range")
    public ResponseEntity<Map<String, Object>> collectExchangeDailyRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        int saved = exchangeRateCollectService.collectDailyRange(startDate, endDate);
        return ResponseEntity.ok(Map.of("saved", saved,
                "startDate", startDate.toString(), "endDate", endDate.toString()));
    }

    // ── 지점별 기상 데이터 (kma_sfcdd.php) ────────────────────────────────────

    /**
     * 지점별 기상 - 특정 날짜 수집 (11개 지점 동시)
     * POST /api/collect/station-weather/date?date=2024-01-15
     */
    @PostMapping("/station-weather/date")
    public ResponseEntity<Map<String, Object>> collectStationWeatherByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        int saved = stationWeatherCollectService.collectByDate(date);
        return ResponseEntity.ok(Map.of("saved", saved, "date", date.toString()));
    }

    /**
     * 지점별 기상 - 특정 연월 수집
     * POST /api/collect/station-weather?year=2024&month=1
     */
    @PostMapping("/station-weather")
    public ResponseEntity<Map<String, Object>> collectStationWeatherByYearMonth(
            @RequestParam int year, @RequestParam int month) {
        int saved = stationWeatherCollectService.collectByYearMonth(year, month);
        return ResponseEntity.ok(Map.of("saved", saved, "year", year, "month", month));
    }

    /**
     * 지점별 기상 - 날짜 범위 수집 (초기 적재용, 백그라운드 비동기 실행)
     * POST /api/collect/station-weather/range?startDate=2017-01-01&endDate=2025-12-31
     *
     * ※ 2017년부터 수집하면 2018년 데이터의 전년값이 자동으로 채워집니다.
     *    일별 100ms 간격으로 호출하므로 수집 시간이 수 분 소요됩니다.
     */
    @PostMapping("/station-weather/range")
    public ResponseEntity<Map<String, Object>> collectStationWeatherByRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        CompletableFuture.runAsync(() ->
                stationWeatherCollectService.collectByDateRange(startDate, endDate));
        return ResponseEntity.ok(Map.of(
                "status", "started",
                "startDate", startDate.toString(),
                "endDate", endDate.toString(),
                "message", "백그라운드에서 수집 중입니다. 서버 로그를 확인하세요."));
    }

    // ── CPI / PPI ─────────────────────────────────────────────────────────────

    /**
     * CPI 수집 (연도 범위)
     * POST /api/collect/cpi?startYear=2018&endYear=2025
     */
    @PostMapping("/cpi")
    public ResponseEntity<Map<String, Object>> collectCpi(
            @RequestParam int startYear, @RequestParam int endYear) {
        int saved = kosisService.collectCpi(startYear, endYear);
        return ResponseEntity.ok(Map.of("saved", saved, "startYear", startYear, "endYear", endYear));
    }

    /**
     * PPI 수집 (연도 범위)
     * POST /api/collect/ppi?startYear=2018&endYear=2025
     */
    @PostMapping("/ppi")
    public ResponseEntity<Map<String, Object>> collectPpi(
            @RequestParam int startYear, @RequestParam int endYear) {
        int saved = kosisService.collectPpi(startYear, endYear);
        return ResponseEntity.ok(Map.of("saved", saved, "startYear", startYear, "endYear", endYear));
    }

}
