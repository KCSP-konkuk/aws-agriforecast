package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.OilPriceCollectService;
import com.agriforecast.backend.service.OilPriceCsvImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OilPriceScheduler {

    private static final Logger logger = LoggerFactory.getLogger(OilPriceScheduler.class);

    private final OilPriceCollectService oilPriceCollectService;
    private final OilPriceCsvImportService oilPriceCsvImportService;

    public OilPriceScheduler(OilPriceCollectService oilPriceCollectService,
                             OilPriceCsvImportService oilPriceCsvImportService) {
        this.oilPriceCollectService = oilPriceCollectService;
        this.oilPriceCsvImportService = oilPriceCsvImportService;
    }

    /**
     * 앱 시작 시 CSV 과거 데이터 적재 후 현재 게시 데이터 보충
     */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void initialLoad() {
        try {
            int csvSaved = oilPriceCsvImportService.importFromCsv();
            logger.info("=== [유가 초기 적재] CSV 적재 완료: {}건 저장 ===", csvSaved);
        } catch (Exception e) {
            logger.error("유가 CSV 적재 실패, API 보충은 계속 진행합니다: {}", e.getMessage());
        }

        try {
            int apiSaved = oilPriceCollectService.collectCurrent();
            logger.info("=== [유가 초기 적재] API 보충 완료: {}건 저장 ===", apiSaved);
        } catch (Exception e) {
            logger.error("유가 API 보충 실패: {}", e.getMessage());
        }
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
