package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.NaverNewsItem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;

@Service
public class NaverNewsService {

    private static final Logger logger = LoggerFactory.getLogger(NaverNewsService.class);
    private static final String NEWS_URL = "https://openapi.naver.com/v1/search/news.json";

    @Value("${naver.search.client-id}")
    private String clientId;

    @Value("${naver.search.client-secret}")
    private String clientSecret;

    @Autowired
    private RestTemplate restTemplate;

    public List<NaverNewsItem> getAgriNews() {
        String url = UriComponentsBuilder.fromHttpUrl(NEWS_URL)
                .queryParam("query", "농산물")
                .queryParam("display", 5)
                .queryParam("sort", "date")
                .build()
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Naver-Client-Id", clientId);
        headers.set("X-Naver-Client-Secret", clientSecret);

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        List<NaverNewsItem> result = new ArrayList<>();

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            String body = response.getBody();
            if (body == null || body.isBlank()) {
                logger.warn("네이버 뉴스 API 응답이 비어있습니다.");
                return result;
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(body);
            JsonNode items = root.get("items");

            if (items == null || !items.isArray()) {
                logger.warn("네이버 뉴스 API items 필드를 찾을 수 없습니다.");
                return result;
            }

            for (JsonNode item : items) {
                NaverNewsItem news = new NaverNewsItem();
                news.setTitle(stripHtml(getText(item, "title")));
                news.setLink(getText(item, "link"));
                news.setOriginallink(getText(item, "originallink"));
                news.setDescription(stripHtml(getText(item, "description")));
                news.setPubDate(getText(item, "pubDate"));
                result.add(news);
            }

            logger.info("네이버 뉴스 조회 완료 - 건수: {}", result.size());
        } catch (Exception e) {
            logger.error("네이버 뉴스 API 호출 실패: {}", e.getMessage());
        }

        return result;
    }

    private String getText(JsonNode node, String field) {
        JsonNode f = node.get(field);
        return (f != null && !f.isNull()) ? f.asText("").trim() : "";
    }

    private String stripHtml(String text) {
        return text.replaceAll("<[^>]*>", "");
    }
}
