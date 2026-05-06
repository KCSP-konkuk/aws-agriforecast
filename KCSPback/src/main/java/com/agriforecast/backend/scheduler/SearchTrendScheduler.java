package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.NaverDataLabService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 네이버 검색량 데이터 수집 스케줄러.
 *
 * [매일 새벽 4시]
 *  전날 검색량 API 호출 → DB 저장
 */
@Component
public class SearchTrendScheduler {

    private static final Logger logger = LoggerFactory.getLogger(SearchTrendScheduler.class);
    private static final List<String> KEYWORDS = List.of("배추", "양파", "양배추", "당근");

    private final NaverDataLabService naverDataLabService;

    public SearchTrendScheduler(NaverDataLabService naverDataLabService) {
        this.naverDataLabService = naverDataLabService;
    }

    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void dailyCollect() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        logger.info("검색량 일별 자동 수집 시작: {}", yesterday);

        for (String keyword : KEYWORDS) {
            try {
                int saved = naverDataLabService.collectAndSave(keyword, yesterday, yesterday);
                logger.info("검색량 일별 자동 수집 완료 - keyword={}, saved={}", keyword, saved);
            } catch (Exception e) {
                logger.error("검색량 일별 자동 수집 실패 - keyword={}, date={}: {}",
                        keyword, yesterday, e.getMessage());
            }
        }
    }
}
