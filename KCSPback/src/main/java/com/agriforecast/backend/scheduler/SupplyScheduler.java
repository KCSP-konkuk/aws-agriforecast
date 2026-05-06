package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.SupplyCollectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 가락시장 반입량 데이터 적재 스케줄러
 *
 * [매일 새벽 3시]
 *  전날 데이터 API 호출 → DB 저장
 */
@Component
public class SupplyScheduler {

    private static final Logger logger = LoggerFactory.getLogger(SupplyScheduler.class);

    private final SupplyCollectService supplyCollectService;

    public SupplyScheduler(SupplyCollectService supplyCollectService) {
        this.supplyCollectService = supplyCollectService;
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
}
