package com.agriforecast.backend.service;

import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.io.HttpClientConnectionManager;
import org.apache.hc.client5.http.ssl.NoopHostnameVerifier;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory;
import org.apache.hc.core5.ssl.SSLContextBuilder;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.SSLContext;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 한국수출입은행 환율 API 실제 호출 테스트 (DB 불필요)
 * RestTemplateConfig와 동일한 SSL 설정 사용
 */
class ExchangeRateApiTest {

    private static final String API_URL =
            "https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey={authkey}&searchdate={date}&data=AP01";
    private static final String AUTH_KEY = "MQYSy7sOTVB76RkvczAcMmPyefDqXLNl";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private static RestTemplate restTemplate;

    @BeforeAll
    static void setup() throws Exception {
        SSLContext sslContext = SSLContextBuilder.create()
                .loadTrustMaterial((chain, authType) -> true)
                .build();

        SSLConnectionSocketFactory sslSocketFactory =
                new SSLConnectionSocketFactory(sslContext, NoopHostnameVerifier.INSTANCE);

        HttpClientConnectionManager connectionManager =
                PoolingHttpClientConnectionManagerBuilder.create()
                        .setSSLSocketFactory(sslSocketFactory)
                        .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .build();

        restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
    }

    @Test
    void 평일_환율_API_호출_성공() {
        LocalDate testDate = LocalDate.of(2025, 3, 24);
        List<Map<String, Object>> rates = fetchRates(testDate);

        assertNotNull(rates, "API 응답이 null");
        assertFalse(rates.isEmpty(), "API 응답이 비어있음");

        Double usd = extractRate(rates, "USD");
        assertNotNull(usd, "USD 환율이 null");
        assertTrue(usd > 1000 && usd < 2000, "USD 환율 범위 이상: " + usd);

        Double cny = extractRate(rates, "CNH");
        assertNotNull(cny, "CNY 환율이 null");
        assertTrue(cny > 100 && cny < 500, "CNY 환율 범위 이상: " + cny);

        System.out.println("=== 환율 API 테스트 결과 ===");
        System.out.println("날짜: " + testDate);
        System.out.println("USD/KRW: " + usd);
        System.out.println("CNY/KRW: " + cny);
        System.out.println("전체 통화 수: " + rates.size());
    }

    @Test
    void 주말_환율_API_빈_응답() {
        LocalDate saturday = LocalDate.of(2025, 3, 22);
        List<Map<String, Object>> rates = fetchRates(saturday);

        assertTrue(rates == null || rates.isEmpty(),
                "주말인데 데이터가 있음: " + (rates != null ? rates.size() : 0));

        System.out.println("=== 주말 테스트 통과 (데이터 없음 확인) ===");
    }

    @Test
    void 오늘_환율_API_호출() {
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> rates = fetchRates(today);

        System.out.println("=== 오늘(" + today + ") 환율 API 결과 ===");

        if (today.getDayOfWeek().getValue() >= 6) {
            System.out.println("오늘은 주말 - 데이터 없음 예상");
            assertTrue(rates == null || rates.isEmpty());
        } else if (rates == null || rates.isEmpty()) {
            System.out.println("공휴일이거나 아직 11시 전 - 데이터 없음");
        } else {
            Double usd = extractRate(rates, "USD");
            Double cny = extractRate(rates, "CNH");
            System.out.println("USD/KRW: " + usd);
            System.out.println("CNY/KRW: " + cny);
            assertNotNull(usd);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchRates(LocalDate date) {
        try {
            Map<String, String> params = Map.of("authkey", AUTH_KEY, "date", date.format(DATE_FMT));
            Object[] response = restTemplate.getForObject(API_URL, Object[].class, params);
            if (response == null || response.length == 0) return null;

            List<Map<String, Object>> result = new ArrayList<>();
            for (Object item : response) {
                if (item instanceof Map) result.add((Map<String, Object>) item);
            }
            return result;
        } catch (Exception e) {
            System.err.println("API 호출 실패: " + e.getMessage());
            return null;
        }
    }

    private Double extractRate(List<Map<String, Object>> rates, String currency) {
        if (rates == null) return null;
        return rates.stream()
                .filter(r -> currency.equals(r.get("cur_unit")))
                .map(r -> {
                    String val = String.valueOf(r.get("deal_bas_r")).replace(",", "");
                    try { return Double.parseDouble(val); } catch (Exception e) { return null; }
                })
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }
}
