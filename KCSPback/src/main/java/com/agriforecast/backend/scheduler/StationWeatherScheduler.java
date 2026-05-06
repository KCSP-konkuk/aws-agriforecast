package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.StationWeatherCollectService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 지점별 기상 데이터 적재 스케줄러
 *
 * [매일 새벽 1시]
 *  전날 데이터 API 호출 → DB 저장
 */
@Component
public class StationWeatherScheduler {

    private static final Logger logger = LoggerFactory.getLogger(StationWeatherScheduler.class);

    private final StationWeatherCollectService stationWeatherCollectService;

    public StationWeatherScheduler(StationWeatherCollectService stationWeatherCollectService) {
        this.stationWeatherCollectService = stationWeatherCollectService;
    }

    /**
     * 매일 새벽 1시: 전날 데이터 수집
     */
    @Scheduled(cron = "0 0 1 * * *")
    public void dailyCollect() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        logger.info("일별 기상 수집 시작: {}", yesterday);
        int saved = stationWeatherCollectService.collectByDate(yesterday);
        logger.info("일별 기상 수집 완료: {}건 저장", saved);
    }
}
