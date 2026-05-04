package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.entity.SupplyData;
import com.agriforecast.backend.repository.SupplyDataRepository;
import com.agriforecast.backend.service.SupplyCollectService;
import com.agriforecast.backend.service.SupplyCsvImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Optional;

/**
 * 가락시장 반입량 데이터 적재 스케줄러
 *
 * [앱 시작 시 - 비동기]
 *  1단계: CSV(2018-01-03 ~ 2020-12-31) → DB 적재
 *  2단계: DB 마지막 날짜 다음날 ~ 어제까지 API 호출로 보충
 *
 * [매일 새벽 3시]
 *  전날 데이터 API 호출 → DB 저장
 */
@Component
public class SupplyScheduler {

    private static final Logger logger = LoggerFactory.getLogger(SupplyScheduler.class);

    /** CSV가 없거나 DB가 비어 있을 때 API 수집 기본 시작일 */
    private static final LocalDate API_FALLBACK_START = LocalDate.of(2021, 1, 1);

    private final SupplyCollectService supplyCollectService;
    private final SupplyCsvImportService supplyCsvImportService;
    private final SupplyDataRepository supplyDataRepository;

    public SupplyScheduler(SupplyCollectService supplyCollectService,
                           SupplyCsvImportService supplyCsvImportService,
                           SupplyDataRepository supplyDataRepository) {
        this.supplyCollectService = supplyCollectService;
        this.supplyCsvImportService = supplyCsvImportService;
        this.supplyDataRepository = supplyDataRepository;
    }

    /**
     * 앱 시작 시 초기 적재 (백그라운드 비동기 실행)
     *  1) CSV → DB
     *  2) API → DB (DB 마지막 날짜 다음날 ~ 어제, 누락분만)
     */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void initialLoad() {
        try {
            int csvSaved = supplyCsvImportService.importFromCsv();
            logger.info("=== [반입량 초기 적재] CSV 적재 완료: {}건 저장 ===", csvSaved);
        } catch (Exception e) {
            logger.error("반입량 CSV 적재 실패, API 보충은 계속 진행합니다: {}", e.getMessage());
        }

        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate apiStart = resolveApiStartDate();
        if (!apiStart.isAfter(yesterday)) {
            logger.info("=== [반입량 초기 적재] API 수집 시작: {} ~ {} ===", apiStart, yesterday);
            int saved = supplyCollectService.collectByDateRange(apiStart, yesterday);
            logger.info("=== [반입량 초기 적재] 완료: {}건 저장 ===", saved);
        } else {
            logger.info("=== [반입량 초기 적재] API 보충 스킵 (마지막 적재일이 이미 {} 이상) ===", yesterday);
        }
    }

    /**
     * 매일 새벽 3시: 전날 데이터 수집
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void dailyCollect() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        logger.info("일별 반입량 수집 시작: {}", yesterday);
        int saved = supplyCollectService.collectByDateRange(yesterday, yesterday);
        logger.info("일별 반입량 수집 완료: {}건 저장", saved);
    }

    private LocalDate resolveApiStartDate() {
        Optional<SupplyData> latest = supplyDataRepository.findTopByOrderByYearDescMonthDescDayDesc();
        if (latest.isEmpty()) {
            return API_FALLBACK_START;
        }

        SupplyData data = latest.get();
        return LocalDate.of(data.getYear(), data.getMonth(), data.getDay()).plusDays(1);
    }
}
