package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.OilPriceCollectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OilPriceScheduler {

    private static final Logger logger = LoggerFactory.getLogger(OilPriceScheduler.class);

    private final OilPriceCollectService oilPriceCollectService;

    public OilPriceScheduler(OilPriceCollectService oilPriceCollectService) {
        this.oilPriceCollectService = oilPriceCollectService;
    }

    /**
     * 매일 오전 6시: 오피넷 전국 평균 자동차용경유 가격 수집
     */
    @Scheduled(cron = "0 0 6 * * *", zone = "Asia/Seoul")
    public void collectDailyOilPrice() {
        logger.info("유가 일별 자동 수집 시작");
        int saved = oilPriceCollectService.collectCurrent();
        logger.info("유가 일별 자동 수집 완료 - saved={}", saved);
    }
}
