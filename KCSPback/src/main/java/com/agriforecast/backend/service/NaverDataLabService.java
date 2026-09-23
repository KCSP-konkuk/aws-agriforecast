package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.NaverDataLabResponse;
import com.agriforecast.backend.entity.SearchTrend;
import com.agriforecast.backend.repository.SearchTrendRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class NaverDataLabService {

    private static final Logger logger = LoggerFactory.getLogger(NaverDataLabService.class);
    private static final String DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";
    /** 데이터랩이 제공하는 첫날. 기존 DB 값도 이 날부터 한 번에 받은 것이다 */
    public static final LocalDate SERIES_START = LocalDate.of(2016, 1, 1);
    /** 기존 값이 이보다 크게 바뀌면 경고. 반올림 수준의 차이는 무시한다 */
    private static final double SHIFT_WARN = 0.5;

    @Value("${naver.datalab.client-id}")
    private String clientId;

    @Value("${naver.datalab.client-secret}")
    private String clientSecret;

    private final SearchTrendRepository searchTrendRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    public NaverDataLabService(SearchTrendRepository searchTrendRepository) {
        this.searchTrendRepository = searchTrendRepository;
    }

    /**
     * 검색량 시계열 전체를 다시 받아 덮어쓴다.
     *
     * 데이터랩 값은 실제 검색 수가 아니라 "요청한 기간 안의 최댓값 = 100" 인 상대값이다.
     * 기간을 나눠 받으면 구간마다 기준이 달라지고, 하루만 받으면 그날이 늘 100 이 된다
     * (2026-09-14 ~ 22 에 실제로 그렇게 쌓였다). 그래서 항상 {@link #SERIES_START} 부터 한 번에 받는다.
     * 처음 백필과 같은 요청이라 기존 값은 그대로 재현되고, 새 최고치가 나오면 전체가 같이 다시 맞춰진다.
     */
    public RefreshResult refreshSeries(String keyword, LocalDate endDate) {
        NaverDataLabResponse response = callNaverApi(keyword, SERIES_START, endDate);
        if (response == null || response.getResults() == null || response.getResults().isEmpty()) {
            throw new IllegalStateException("네이버 API 결과 없음 - keyword: " + keyword);
        }

        Map<LocalDate, SearchTrend> existing = new HashMap<>();
        for (SearchTrend t : searchTrendRepository.findByKeywordAndPeriodBetweenOrderByPeriodAsc(
                keyword, SERIES_START, endDate)) {
            existing.put(t.getPeriod(), t);
        }

        List<SearchTrend> toSave = new ArrayList<>();
        int inserted = 0, updated = 0;
        double maxShift = 0;   // 기존에 100 이 아니던 값이 얼마나 바뀌었나 — 크면 기준이 달라졌다는 뜻
        for (NaverDataLabResponse.DataPoint dp : response.getResults().get(0).getData()) {
            LocalDate period = LocalDate.parse(dp.getPeriod());
            SearchTrend t = existing.get(period);
            if (t == null) {
                t = new SearchTrend();
                t.setKeyword(keyword);
                t.setPeriod(period);
                inserted++;
            } else if (!t.getRatio().equals(dp.getRatio())) {
                if (t.getRatio() < 99.99) {
                    maxShift = Math.max(maxShift, Math.abs(t.getRatio() - dp.getRatio()));
                }
                updated++;
            } else {
                continue;
            }
            t.setRatio(dp.getRatio());
            toSave.add(t);
        }
        searchTrendRepository.saveAll(toSave);

        RefreshResult r = new RefreshResult(inserted, updated, maxShift);
        if (maxShift > SHIFT_WARN) {
            logger.warn("검색량 기준 변동 - keyword: {}, {} (새 최고치가 나왔거나 요청 방식이 처음 백필과 다르다)",
                    keyword, r);
        } else {
            logger.info("검색량 갱신 - keyword: {}, {}", keyword, r);
        }
        return r;
    }

    public record RefreshResult(int inserted, int updated, double maxShift) {
        @Override
        public String toString() {
            return String.format("신규 %d, 수정 %d, 기존값 최대 변동 %.4f", inserted, updated, maxShift);
        }
    }

    // 저장된 데이터 조회
    @Transactional(readOnly = true)
    public List<SearchTrend> getTrends(String keyword, LocalDate startDate, LocalDate endDate) {
        return searchTrendRepository.findByKeywordAndPeriodBetweenOrderByPeriodAsc(
                keyword, startDate, endDate);
    }

    protected NaverDataLabResponse callNaverApi(String keyword, LocalDate startDate, LocalDate endDate) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Naver-Client-Id", clientId);
        headers.set("X-Naver-Client-Secret", clientSecret);

        Map<String, Object> body = new HashMap<>();
        body.put("startDate", startDate.toString());
        body.put("endDate", endDate.toString());
        body.put("timeUnit", "date");
        body.put("keywordGroups", List.of(
                Map.of("groupName", keyword, "keywords", List.of(keyword))
        ));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<NaverDataLabResponse> response = restTemplate.exchange(
                DATALAB_URL, HttpMethod.POST, request, NaverDataLabResponse.class);

        return response.getBody();
    }
}
