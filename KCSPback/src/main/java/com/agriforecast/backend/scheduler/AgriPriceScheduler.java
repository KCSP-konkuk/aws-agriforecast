package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.NongnetService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 농산물 가격 데이터 적재 스케줄러
 *
 * [앱 시작 시 - 비동기]
 *  1단계: CSV(2018~2025) → DB 일괄 적재 (추후 구현)
 *  2단계: 2026-01-01 ~ 어제까지 누락 데이터 크롤링으로 보충
 *
 * [매일 11:00 KST]
 *  전날 데이터 크롤링 → DB 저장
 */
@Component
public class AgriPriceScheduler {

    private static final Logger logger = LoggerFactory.getLogger(AgriPriceScheduler.class);

    /** CSV 이후 크롤링 수집 시작일 */
    private static final LocalDate CRAWL_START = LocalDate.of(2026, 3, 22);

    /** 매일 수집 후 되짚어 확인할 일수 (농넷 타임아웃 결손 자동 복구용) */
    private static final int BACKFILL_DAYS = 7;

    private final NongnetService nongnetService;

    public AgriPriceScheduler(NongnetService nongnetService) {
        this.nongnetService = nongnetService;
    }

    /**
     * 앱 시작 시 초기 적재 (백그라운드 비동기 실행)
     *  1) CSV → DB (2018~2025) - 추후 구현
     *  2) 크롤링 → DB (2026-01-01 ~ 어제, 누락분만)
     */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void initialLoad() {
        // 1단계: CSV 적재 (추후 구현)
        // logger.info("=== [1단계] CSV 가격 데이터 적재 시작 ===");

        // 2단계: 2026년 이후 누락 데이터 크롤링 보충
        LocalDate yesterday = LocalDate.now().minusDays(1);
        if (!yesterday.isBefore(CRAWL_START)) {
            logger.info("=== [가격 초기 적재] 크롤링 시작: {} ~ {} ===", CRAWL_START, yesterday);
            int saved = nongnetService.collectPriceByDateRange(CRAWL_START, yesterday);
            logger.info("=== [가격 초기 적재] 완료: {}건 저장 ===", saved);
        } else {
            logger.info("=== [가격 초기 적재] 스킵 (아직 {}에 도달하지 않음) ===", CRAWL_START);
        }
    }

    /**
     * 매일 11:00 KST: 전날 데이터 크롤링 + 최근 7일 누락분 보충
     */
    @Scheduled(cron = "0 0 11 * * *", zone = "Asia/Seoul")
    public void dailyCollect() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        logger.info("일별 가격 수집 시작: {}", yesterday);
        int saved = nongnetService.collectPriceByDateRange(yesterday, yesterday);
        logger.info("일별 가격 수집 완료: {}건 저장", saved);

        // 농넷 타임아웃으로 빠진 날이 영구 결손으로 남지 않도록 최근 구간을 다시 훑는다.
        // collectPriceByDateRange 가 이미 있는 날짜는 건너뛰므로 실제 요청은 결손분에만 나간다.
        LocalDate backfillFrom = yesterday.minusDays(BACKFILL_DAYS - 1L);
        if (backfillFrom.isBefore(CRAWL_START)) {
            backfillFrom = CRAWL_START;
        }
        if (!backfillFrom.isAfter(yesterday)) {
            int refilled = nongnetService.collectPriceByDateRange(backfillFrom, yesterday);
            if (refilled > 0) {
                logger.info("가격 누락분 보충: {} ~ {}, {}건", backfillFrom, yesterday, refilled);
            }
        }
    }
}
