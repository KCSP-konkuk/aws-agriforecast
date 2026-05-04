package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.ExchangeRateCollectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ExchangeRateScheduler {

    private static final Logger logger = LoggerFactory.getLogger(ExchangeRateScheduler.class);

    private final ExchangeRateCollectService exchangeRateCollectService;

    public ExchangeRateScheduler(ExchangeRateCollectService exchangeRateCollectService) {
        this.exchangeRateCollectService = exchangeRateCollectService;
    }

    /**
     * 매일 오전 11시 수집 (한국수출입은행 API는 11시 이후 당일 데이터 제공)
     */
    @Scheduled(cron = "0 20 11 * * *", zone = "Asia/Seoul")
    public void collectDailyExchangeRate() {
        logger.info("환율 일별 자동 수집 시작");
        boolean saved = exchangeRateCollectService.collectToday();
        logger.info("환율 일별 자동 수집 완료 - saved={}", saved);
    }
}
