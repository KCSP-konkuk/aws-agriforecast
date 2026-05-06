package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.ExchangeRateCollectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class ExchangeRateScheduler {

    private static final Logger logger = LoggerFactory.getLogger(ExchangeRateScheduler.class);

    private final ExchangeRateCollectService exchangeRateCollectService;

    public ExchangeRateScheduler(ExchangeRateCollectService exchangeRateCollectService) {
        this.exchangeRateCollectService = exchangeRateCollectService;
    }

    /**
     * 매일 오전 11시 20분: 전날 환율 수집
     */
    @Scheduled(cron = "0 20 11 * * *", zone = "Asia/Seoul")
    public void collectDailyExchangeRate() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        logger.info("환율 일별 자동 수집 시작: {}", yesterday);
        boolean saved = exchangeRateCollectService.collectByDate(yesterday);
        logger.info("환율 일별 자동 수집 완료 - date={}, saved={}", yesterday, saved);
    }
}
