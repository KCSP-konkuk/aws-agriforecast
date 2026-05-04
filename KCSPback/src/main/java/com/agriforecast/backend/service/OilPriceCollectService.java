package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.OilPrice;
import com.agriforecast.backend.repository.OilPriceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 오피넷 전국 주유소 평균가격 API -> OilPrice DB 저장
 */
@Service
@Transactional
public class OilPriceCollectService {

    private static final Logger logger = LoggerFactory.getLogger(OilPriceCollectService.class);
    private static final String AVG_ALL_PRICE_URL =
            "https://www.opinet.co.kr/api/avgAllPrice.do?out=json&code={key}";
    private static final String TARGET_PRODUCT_NAME = "자동차용경유";
    private static final DateTimeFormatter TRADE_DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Value("${opinet.api-key}")
    private String apiKey;

    private final OilPriceRepository oilPriceRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    public OilPriceCollectService(OilPriceRepository oilPriceRepository, ObjectMapper objectMapper) {
        this.oilPriceRepository = oilPriceRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 현재 오피넷에 게시 중인 전국 주유소 평균가격을 저장한다.
     */
    public int collectCurrent() {
        List<Map<String, Object>> items = fetchAveragePrices();
        int savedCount = 0;

        for (Map<String, Object> item : items) {
            LocalDate priceDate = parseTradeDate(item.get("TRADE_DT"));
            String productName = parseString(item.get("PRODNM"));
            Double avgPrice = parsePrice(item.get("PRICE"));

            if (priceDate == null || productName == null || avgPrice == null) {
                continue;
            }
            if (!TARGET_PRODUCT_NAME.equals(productName)) {
                continue;
            }
            if (oilPriceRepository.findByPriceDateAndProductName(priceDate, productName).isPresent()) {
                continue;
            }

            OilPrice entity = new OilPrice();
            entity.setPriceDate(priceDate);
            entity.setProductName(productName);
            entity.setAvgPrice(avgPrice);
            oilPriceRepository.save(entity);
            savedCount++;
        }

        logger.info("유가 전국 평균가격 저장 완료 - 대상={}, 신규 {}건", TARGET_PRODUCT_NAME, savedCount);
        return savedCount;
    }

    /**
     * 기존 /api/collect/all 호출부 호환용. 오피넷 API는 날짜 파라미터를 받지 않으므로 year/month는 사용하지 않는다.
     */
    public int collectByYearMonth(int year, int month) {
        return collectCurrent();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchAveragePrices() {
        String url = AVG_ALL_PRICE_URL.replace("{key}", apiKey);
        String body = restTemplate.getForObject(url, String.class);
        Map<String, Object> response = parseJsonBody(body);
        if (response == null) {
            return List.of();
        }

        Object result = response.get("RESULT");
        if (!(result instanceof Map<?, ?> resultMap)) {
            return List.of();
        }

        Object oil = resultMap.get("OIL");
        if (oil instanceof List<?>) {
            return (List<Map<String, Object>>) oil;
        }

        return List.of();
    }

    private Map<String, Object> parseJsonBody(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(body, Map.class);
        } catch (JsonProcessingException e) {
            logger.warn("오피넷 응답 JSON 파싱 실패 - body={}", body);
            return null;
        }
    }

    private LocalDate parseTradeDate(Object value) {
        String date = parseString(value);
        if (date == null) {
            return null;
        }
        return LocalDate.parse(date, TRADE_DATE_FMT);
    }

    private String parseString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty() || "null".equalsIgnoreCase(text)) {
            return null;
        }
        return text;
    }

    private Double parsePrice(Object value) {
        String price = parseString(value);
        if (price == null) {
            return null;
        }
        try {
            return Double.parseDouble(price.replace(",", ""));
        } catch (NumberFormatException e) {
            logger.debug("유가 평균가격 파싱 실패 - value={}", value);
            return null;
        }
    }
}
