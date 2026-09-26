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

    // 쌀/20kg(272), 콩(275), 고구마(281), 감자/수미(285), 양배추(297), 상추/적(301)
    private static final Set<String> TARGET_PRODUCTS = Set.of("272", "275", "281", "285", "297", "301");
    // 배추는 계절마다 품목번호가 바뀐다(여름 291 '배추/여름(고랭지)', 그 외 295 등) → 이름으로 고른다.
    // '배추/' 로 시작하는 것만 — 양배추·알배기배추·얼갈이배추는 이름이 달라 걸리지 않는다
    private static final String CABBAGE_PREFIX = "배추/";

    private static final String KAMIS_URL =
            "https://www.kamis.or.kr/service/price/xml.do?action=dailySalesList" +
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

                String name = getText(item, "productName");
                if (!isTarget(productClsCode, productNo, name)) {
                    continue;
                }

                KamisDailyPriceResponse dto = new KamisDailyPriceResponse();
                dto.setItemName(name.isBlank() ? getText(item, "item_name") : name);
                dto.setUnit(getText(item, "unit"));
                dto.setPrice(getText(item, "dpr1"));
                dto.setDirection(getText(item, "direction"));
                dto.setChangeRate(getText(item, "value"));
                dto.setLastDate(getText(item, "lastest_day"));
                result.add(dto);
            }

            logger.info("KAMIS 일일 가격 조회 완료 - 품목 수: {}", result.size());
        } catch (Exception e) {
            logger.error("KAMIS API 호출 실패: {}", e.getMessage());
        }

        return result;
    }

    /** 소매(01) 가격 중 홈 화면에 보여줄 품목인지 */
    static boolean isTarget(String productClsCode, String productNo, String productName) {
        if (!"01".equals(productClsCode)) return false;
        return TARGET_PRODUCTS.contains(productNo) || productName.startsWith(CABBAGE_PREFIX);
    }

    private String getText(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        return (field != null && !field.isNull()) ? field.asText("").trim() : "";
    }
}
