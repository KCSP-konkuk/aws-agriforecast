package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.MarketBriefService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/** 순 첫날(1·11·21일) 12:10 KST — 일별 가격 수집(11:00, 전날분) 뒤에 시세 브리핑 */
@Component
public class MarketBriefScheduler {

    private final MarketBriefService marketBriefService;

    public MarketBriefScheduler(MarketBriefService marketBriefService) {
        this.marketBriefService = marketBriefService;
    }

    @Scheduled(cron = "0 10 12 1,11,21 * *", zone = "Asia/Seoul")
    public void publish() {
        marketBriefService.publish(LocalDate.now(ZoneId.of("Asia/Seoul")));
    }
}
