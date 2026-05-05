package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.KamisDailyPriceResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class KamisService {

    private static final Logger logger = LoggerFactory.getLogger(KamisService.class);

    // 쌀(111), 콩(141), 고구마(151), 감자(152), 배추(211), 양배추(212), 상추(214)
    private static final Set<String> TARGET_PRODUCTS = Set.of("111", "141", "151", "152", "211", "212", "214");

    private static final String KAMIS_URL =
            "http://www.kamis.or.kr/service/price/xml.do?action=dailySalesList" +
            "&p_cert_key=%s&p_cert_id=%s&p_returntype=json";

    @Value("${kamis.cert-key:test}")
    private String certKey;

    @Value("${kamis.cert-id:test}")
    private String certId;

    @Autowired
    private RestTemplate restTemplate;

    public List<KamisDailyPriceResponse> getDailyPrices() {
        String url = String.format(KAMIS_URL, certKey, certId);
        List<KamisDailyPriceResponse> result = new ArrayList<>();

        try {
            ResponseEntity<String> responseEntity = restTemplate.getForEntity(url, String.class);
            String body = responseEntity.getBody();
            if (body == null || body.isBlank()) {
                logger.warn("KAMIS API 응답이 비어 있습니다.");
                return result;
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(body);
            JsonNode priceArray = root.get("price");

            if (priceArray == null || !priceArray.isArray()) {
                logger.warn("KAMIS API price 필드를 찾을 수 없습니다. 응답: {}", body.substring(0, Math.min(200, body.length())));
                return result;
            }

            for (JsonNode item : priceArray) {
                String productClsCode = getText(item, "product_cls_code");
                String productNo = getText(item, "productno");

                // 소매(01) + 대상 품목만 필터
                if (!"01".equals(productClsCode) || !TARGET_PRODUCTS.contains(productNo)) {
                    continue;
                }

                KamisDailyPriceResponse dto = new KamisDailyPriceResponse();
                String name = getText(item, "productName");
                dto.setItemName(name.isBlank() ? getText(item, "item_name") : name);
                dto.setUnit(getText(item, "unit"));
                dto.setPrice(getText(item, "dpr1"));
                dto.setDirection(getText(item, "direction"));
                dto.setChangeRate(getText(item, "value"));
                dto.setLastDate(getText(item, "day1"));
                result.add(dto);
            }

            logger.info("KAMIS 일일 가격 조회 완료 - 품목 수: {}", result.size());
        } catch (Exception e) {
            logger.error("KAMIS API 호출 실패: {}", e.getMessage());
        }

        return result;
    }

    private String getText(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        return (field != null && !field.isNull()) ? field.asText("").trim() : "";
    }
}
