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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class NaverDataLabService {

    private static final Logger logger = LoggerFactory.getLogger(NaverDataLabService.class);
    private static final String DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";

    @Value("${naver.datalab.client-id}")
    private String clientId;

    @Value("${naver.datalab.client-secret}")
    private String clientSecret;

    private final SearchTrendRepository searchTrendRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    public NaverDataLabService(SearchTrendRepository searchTrendRepository) {
        this.searchTrendRepository = searchTrendRepository;
    }

    // 네이버 DataLab API 호출 후 DB 저장
    public int collectAndSave(String keyword, LocalDate startDate, LocalDate endDate) {
        NaverDataLabResponse response = callNaverApi(keyword, startDate, endDate);

        if (response.getResults() == null || response.getResults().isEmpty()) {
            logger.warn("네이버 API 결과 없음 - keyword: {}", keyword);
            return 0;
        }

        List<NaverDataLabResponse.DataPoint> dataPoints = response.getResults().get(0).getData();
        int savedCount = 0;

        for (NaverDataLabResponse.DataPoint dp : dataPoints) {
            LocalDate period = LocalDate.parse(dp.getPeriod());

            // 중복 저장 방지
            if (searchTrendRepository.findByKeywordAndPeriod(keyword, period).isPresent()) {
                continue;
            }

            SearchTrend trend = new SearchTrend();
            trend.setKeyword(keyword);
            trend.setPeriod(period);
            trend.setRatio(dp.getRatio());
            searchTrendRepository.save(trend);
            savedCount++;
        }

        logger.info("검색 트렌드 저장 완료 - keyword: {}, 저장 건수: {}", keyword, savedCount);
        return savedCount;
    }

    // 저장된 데이터 조회
    @Transactional(readOnly = true)
    public List<SearchTrend> getTrends(String keyword, LocalDate startDate, LocalDate endDate) {
        return searchTrendRepository.findByKeywordAndPeriodBetweenOrderByPeriodAsc(
                keyword, startDate, endDate);
    }

    private NaverDataLabResponse callNaverApi(String keyword, LocalDate startDate, LocalDate endDate) {
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
