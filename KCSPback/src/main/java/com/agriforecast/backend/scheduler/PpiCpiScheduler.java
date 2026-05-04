package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.KosisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class PpiCpiScheduler {

    private static final Logger logger = LoggerFactory.getLogger(PpiCpiScheduler.class);

    private final KosisService kosisService;

    public PpiCpiScheduler(KosisService kosisService) {
        this.kosisService = kosisService;
    }

    /**
     * 하루 3회 자동 수집 - 오전 9시 / 오후 2시 / 오후 8시 (한국시간)
     * 중복 데이터는 KosisService에서 자동 스킵
     */
    @Scheduled(cron = "0 0 9,14,20 * * *", zone = "Asia/Seoul")
    public void collectMonthly() {
        int currentYear = LocalDate.now().getYear();
        logger.info("PPI/CPI 월별 자동 수집 시작 - 대상 연도: {}", currentYear);

        try {
            int cpiSaved = kosisService.collectCpi(currentYear, currentYear);
            logger.info("CPI 자동 수집 완료 - {}년 신규 저장: {}건", currentYear, cpiSaved);
        } catch (Exception e) {
            logger.error("CPI 자동 수집 실패: {}", e.getMessage());
        }

        try {
            int ppiSaved = kosisService.collectPpi(currentYear, currentYear);
            logger.info("PPI 자동 수집 완료 - {}년 신규 저장: {}건", currentYear, ppiSaved);
        } catch (Exception e) {
            logger.error("PPI 자동 수집 실패: {}", e.getMessage());
        }

        logger.info("PPI/CPI 월별 자동 수집 종료");
    }
}
