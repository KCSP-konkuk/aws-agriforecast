package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.CsvWeatherImportService;
import com.agriforecast.backend.service.StationWeatherCollectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 지점별 기상 데이터 적재 스케줄러
 *
 * [앱 시작 시 - 비동기]
 *  1단계: CSV(2018~2025) → DB 일괄 적재 (이미 있으면 스킵)
 *  2단계: 2026-01-01 ~ 어제까지 누락 데이터 API 호출로 보충
 *
 * [매일 새벽 1시]
 *  전날 데이터 API 호출 → DB 저장
 */
@Component
public class StationWeatherScheduler {

    private static final Logger logger = LoggerFactory.getLogger(StationWeatherScheduler.class);

    /** CSV 이후 API 수집 시작일 */
    private static final LocalDate API_START = LocalDate.of(2026, 1, 1);

    private final CsvWeatherImportService csvWeatherImportService;
    private final StationWeatherCollectService stationWeatherCollectService;

    public StationWeatherScheduler(CsvWeatherImportService csvWeatherImportService,
                                   StationWeatherCollectService stationWeatherCollectService) {
        this.csvWeatherImportService = csvWeatherImportService;
        this.stationWeatherCollectService = stationWeatherCollectService;
    }

    /**
     * 앱 시작 시 초기 적재 (백그라운드 비동기 실행)
     *  1) CSV → DB (2018~2025)
     *  2) API → DB (2026-01-01 ~ 어제, 누락분만)
     */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void initialLoad() {
        // 1단계: CSV 적재
        logger.info("=== [1단계] CSV 기상 데이터 적재 시작 ===");
        try {
            int csvSaved = csvWeatherImportService.importFromCsv();
            logger.info("=== [1단계] CSV 적재 완료: {}건 저장 ===", csvSaved);
        } catch (Exception e) {
            logger.error("CSV 적재 실패, 2단계는 계속 진행합니다: {}", e.getMessage());
        }

        // 2단계: 2026년 이후 누락 데이터 API 보충
        LocalDate yesterday = LocalDate.now().minusDays(1);
        if (!yesterday.isBefore(API_START)) {
            logger.info("=== [2단계] API 기상 데이터 보충 시작: {} ~ {} ===", API_START, yesterday);
            int apiSaved = stationWeatherCollectService.collectByDateRange(API_START, yesterday);
            logger.info("=== [2단계] API 보충 완료: {}건 저장 ===", apiSaved);
        } else {
            logger.info("=== [2단계] API 보충 스킵 (아직 {}에 도달하지 않음) ===", API_START);
        }
    }

    /**
     * 매일 새벽 1시: 전날 데이터 수집
     */
    @Scheduled(cron = "0 0 1 * * *")
    public void dailyCollect() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        logger.info("일별 기상 수집 시작: {}", yesterday);
        int saved = stationWeatherCollectService.collectByDate(yesterday);
        logger.info("일별 기상 수집 완료: {}건 저장", saved);
    }
}