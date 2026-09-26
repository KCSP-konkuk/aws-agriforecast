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
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class NaverNewsService {

    private static final Logger logger = LoggerFactory.getLogger(NaverNewsService.class);
    private static final String NEWS_URL = "https://openapi.naver.com/v1/search/news.json";

    // "농산물" 하나로 최신순 검색하면 본문에 단어만 스친 기사(외교·반도체 등)가 섞인다.
    // 시세 중심 검색어 여러 개로 모은 뒤, 제목에 농산물 관련 단어가 있는 기사만 남긴다
    private static final List<String> QUERIES = List.of("농산물 가격", "채소 가격", "배추 가격", "양파 가격", "고추 가격");
    private static final List<String> TITLE_KEYWORDS = List.of(
            "농산물", "농축산", "농수산", "농산", "채소", "과일", "배추", "양파", "고추", "대파", "감자", "마늘",
            "사과", "쌀값", "가락시장", "도매시장", "작황", "출하", "김장", "장바구니", "밥상");
    private static final int DISPLAY_PER_QUERY = 20;
    private static final int RESULT_SIZE = 5;
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    @Value("${naver.search.client-id}")
    private String clientId;

    @Value("${naver.search.client-secret}")
    private String clientSecret;

    @Autowired
    private RestTemplate restTemplate;

    private final ObjectMapper mapper = new ObjectMapper();

    // 홈 화면 방문마다 검색어 5개를 호출하지 않도록 짧게 캐시한다. 빈 결과는 캐시하지 않는다
    private volatile List<NaverNewsItem> cached = List.of();
    private volatile Instant cachedAt = Instant.EPOCH;

    public List<NaverNewsItem> getAgriNews() {
        if (!cached.isEmpty() && Instant.now().isBefore(cachedAt.plus(CACHE_TTL))) {
            return cached;
        }

        Map<String, NaverNewsItem> byTitle = new LinkedHashMap<>();
        for (String query : QUERIES) {
            for (NaverNewsItem item : search(query)) {
                if (isAgriTitle(item.getTitle())) {
                    byTitle.putIfAbsent(normalize(item.getTitle()), item);
                }
            }
        }

        List<NaverNewsItem> result = byTitle.values().stream()
                .sorted(Comparator.comparing(this::publishedAt).reversed())
                .limit(RESULT_SIZE)
                .toList();

        logger.info("네이버 뉴스 조회 완료 - 후보 {}건 중 {}건", byTitle.size(), result.size());
        if (!result.isEmpty()) {
            cached = result;
            cachedAt = Instant.now();
        }
        return result;
    }

    // 테스트에서 네이버 호출 없이 응답을 바꿔 끼울 수 있도록 protected
    protected List<NaverNewsItem> search(String query) {
        String url = UriComponentsBuilder.fromUriString(NEWS_URL)
                .queryParam("query", query)
                .queryParam("display", DISPLAY_PER_QUERY)
                .queryParam("sort", "date")
                .build()
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Naver-Client-Id", clientId);
        headers.set("X-Naver-Client-Secret", clientSecret);

        List<NaverNewsItem> result = new ArrayList<>();
        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            String body = response.getBody();
            if (body == null || body.isBlank()) {
                logger.warn("네이버 뉴스 API 응답이 비어있습니다. query={}", query);
                return result;
            }

            JsonNode items = mapper.readTree(body).get("items");
            if (items == null || !items.isArray()) {
                logger.warn("네이버 뉴스 API items 필드를 찾을 수 없습니다. query={}", query);
                return result;
            }

            for (JsonNode item : items) {
                NaverNewsItem news = new NaverNewsItem();
                news.setTitle(clean(getText(item, "title")));
                news.setLink(getText(item, "link"));
                news.setOriginallink(getText(item, "originallink"));
                news.setDescription(clean(getText(item, "description")));
                news.setPubDate(getText(item, "pubDate"));
                result.add(news);
            }
        } catch (Exception e) {
            logger.error("네이버 뉴스 API 호출 실패 query={}: {}", query, e.getMessage());
        }
        return result;
    }

    private boolean isAgriTitle(String title) {
        return TITLE_KEYWORDS.stream().anyMatch(title::contains);
    }

    // 같은 기사가 여러 매체·검색어로 중복되는 경우가 많아 공백·기호를 뺀 제목으로 비교한다
    private String normalize(String title) {
        return title.replaceAll("[^0-9A-Za-z가-힣]", "");
    }

    private Instant publishedAt(NaverNewsItem item) {
        try {
            return OffsetDateTime.parse(item.getPubDate(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (Exception e) {
            return Instant.EPOCH;
        }
    }

    private String getText(JsonNode node, String field) {
        JsonNode f = node.get(field);
        return (f != null && !f.isNull()) ? f.asText("").trim() : "";
    }

    // 네이버는 검색어를 <b> 로 감싸고 따옴표 등을 &quot; 같은 엔티티로 준다
    private String clean(String text) {
        return HtmlUtils.htmlUnescape(text.replaceAll("<[^>]*>", ""));
    }
}
