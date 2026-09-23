package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.NaverDataLabService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 네이버 검색량 데이터 수집 스케줄러.
 *
 * [매일 10:30 KST]
 *  키워드마다 2016-01-01 ~ 어제를 한 번에 다시 받아 덮어쓴다.
 *  데이터랩 값은 요청 기간 기준 상대값이라 하루씩 받으면 매일 100 이 된다(2026-09-14 ~ 22 사고).
 */
@Component
public class SearchTrendScheduler {

    private static final Logger logger = LoggerFactory.getLogger(SearchTrendScheduler.class);
    private static final List<String> KEYWORDS = List.of("배추", "양파", "양배추", "당근");

    private final NaverDataLabService naverDataLabService;

    public SearchTrendScheduler(NaverDataLabService naverDataLabService) {
        this.naverDataLabService = naverDataLabService;
    }

    @Scheduled(cron = "0 30 10 * * *", zone = "Asia/Seoul")
    public void dailyCollect() {
        LocalDate yesterday = LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1);
        logger.info("검색량 전체 갱신 시작: {} ~ {}", NaverDataLabService.SERIES_START, yesterday);

        for (String keyword : KEYWORDS) {
            try {
                naverDataLabService.refreshSeries(keyword, yesterday);
            } catch (Exception e) {
                logger.error("검색량 갱신 실패 - keyword={}, end={}: {}", keyword, yesterday, e.getMessage());
            }
        }
    }
}
