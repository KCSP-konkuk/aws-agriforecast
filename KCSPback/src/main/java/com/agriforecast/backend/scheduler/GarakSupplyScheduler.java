package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.GarakSupplyService;
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
 * 가락시장 순별 반입량(농넷) 적재 스케줄러 — 품목은 GarakSupplyService.ITEMS
 *
 * [앱 시작 시 - 비동기] 2014-01 ~ 오늘. 품목 · 코드당 9순씩 요청하고, 9순이 모두 있는 지난 구간은 건너뛴다.
 *   첫 적재는 품목당 약 52회(파프리카는 색깔 코드 4개라 ×4) = 약 780회, 요청 사이 1.5초에 응답 몇 초라 한 시간 안팎
 * [매일 11:40 KST] 최근 9순을 다시 받는다 — 진행 중인 순(어제까지 합)과 늦게 고쳐진 값.
 *   인사이트(12:40) · 통합 시계열(12:50) 배치 전에 들어온다
 */
@Component
public class GarakSupplyScheduler {

    private static final Logger logger = LoggerFactory.getLogger(GarakSupplyScheduler.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 적재 시작일 — 작업대 KAMIS 소매 · 도매와 같은 2014-01 */
    static final LocalDate START = LocalDate.of(2014, 1, 1);

    private final GarakSupplyService garakSupplyService;

    public GarakSupplyScheduler(GarakSupplyService garakSupplyService) {
        this.garakSupplyService = garakSupplyService;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void initialLoad() {
        LocalDate today = LocalDate.now(KST);
        logger.info("=== [가락 순별 반입량 초기 적재] {} ~ {} ===", START, today);
        int changed = garakSupplyService.collect(START, today, true);
        logger.info("=== [가락 순별 반입량 초기 적재] 완료: {}건 저장 · 수정 ===", changed);
    }

    @Scheduled(cron = "0 40 11 * * *", zone = "Asia/Seoul")
    public void collectRecent() {
        LocalDate today = LocalDate.now(KST);
        int changed = garakSupplyService.collect(today, today, false);
        logger.info("가락 순별 반입량 최근 9순 수집: {}건 저장 · 수정", changed);
    }
}
