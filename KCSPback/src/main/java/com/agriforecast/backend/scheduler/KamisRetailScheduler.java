package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.KamisRetailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * KAMIS 서울 소매가 적재 스케줄러
 *
 * [앱 시작 시 - 비동기] API 가 주는 가장 이른 날(2025-01-01) ~ 오늘. 품목당 연 1회 요청이라 몇 번 안 된다
 * [매일 09:30 / 17:30 KST] 최근 14일을 다시 받는다 (당일 조사분 반영 + 늦게 올라온 값 보정)
 */
@Component
public class KamisRetailScheduler {

    private static final Logger logger = LoggerFactory.getLogger(KamisRetailScheduler.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** API 로 조회되는 가장 이른 날. 그 이전을 요청하면 응답이 오지 않는다 (2026-09-28 확인) */
    static final LocalDate API_START = LocalDate.of(2025, 1, 1);

    private static final int RECENT_DAYS = 14;

    private final KamisRetailService kamisRetailService;

    public KamisRetailScheduler(KamisRetailService kamisRetailService) {
        this.kamisRetailService = kamisRetailService;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void initialLoad() {
        LocalDate today = LocalDate.now(KST);
        logger.info("=== [KAMIS 소매 초기 적재] {} ~ {} ===", API_START, today);
        int changed = kamisRetailService.collect(API_START, today);
        logger.info("=== [KAMIS 소매 초기 적재] 완료: {}건 저장·수정 ===", changed);
    }

    @Scheduled(cron = "0 30 9,17 * * *", zone = "Asia/Seoul")
    public void collectRecent() {
        LocalDate today = LocalDate.now(KST);
        LocalDate from = today.minusDays(RECENT_DAYS - 1L);
        int changed = kamisRetailService.collect(from, today);
        logger.info("KAMIS 소매 최근 수집 {} ~ {}: {}건 저장·수정", from, today, changed);
    }
}
