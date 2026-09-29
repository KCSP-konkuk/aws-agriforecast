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
 * [앱 시작 시 - 비동기] 2014-01-01 ~ 오늘. 품목당 연 1회 요청. 판매처별 값이 이미 있는 지난 해는 건너뛰어
 *   첫 적재만 품목 3 × 13년 = 39회, 그 뒤 재시작은 올해분 3회
 * [매일 09:30 / 17:30 KST] 최근 14일을 다시 받는다 (당일 조사분 반영 + 늦게 올라온 값 보정)
 */
@Component
public class KamisRetailScheduler {

    private static final Logger logger = LoggerFactory.getLogger(KamisRetailScheduler.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /**
     * 적재 시작일. 서울 판매처 중 경동은 세 품목 모두 2014-01~, 복조리는 2014-07~ 빈틈없이 있다 (2026-09-28 확인).
     * 소매 모델 목표 = 경동·복조리 평균
     */
    static final LocalDate API_START = LocalDate.of(2014, 1, 1);

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
        int changed = kamisRetailService.collect(API_START, today, true);
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
