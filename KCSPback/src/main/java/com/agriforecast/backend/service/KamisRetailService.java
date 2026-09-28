package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.RetailPrice;
import com.agriforecast.backend.repository.RetailPriceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * KAMIS Open API「신) 일별 품목별 소매 가격자료」(periodRetailProductList) → retail_price
 *
 * 서울(1101) · 상품(04) 등급. 응답의 '평균' 행이 서울 판매처 값의 평균이다.
 * API 동작 메모 (2026-09-28 확인)
 *  - p_kindcode·p_countrycode 를 비우거나, 데이터가 없는 기간(2025년 이전 등)을 요청하면
 *    에러 대신 응답이 오지 않는다 → 이 서비스만 읽기 타임아웃을 건 RestTemplate 을 쓴다
 *  - 1회 조회는 최대 1년. 요청 시작일보다 이른 날짜(그 품종 조사 시작일부터)가 섞여 오기도 한다
 *  - 짧은 구간(예: 2026-09-01~09-23, 2026-01-01~01-10)은 응답이 안 오는 일이 있었고
 *    '1월 1일 ~ 연말(올해는 오늘)' 통째 조회는 매번 왔다 → 항상 연 단위로 받아 원하는 구간만 남긴다
 *  - 값이 없는 날은 "-"
 */
@Service
public class KamisRetailService {

    private static final Logger logger = LoggerFactory.getLogger(KamisRetailService.class);

    private static final String URL = "https://www.kamis.or.kr/service/price/xml.do";
    private static final String SEOUL = "1101";
    private static final String RANK_TOP = "04";   // 상품
    private static final long REQUEST_GAP_MS = 1000;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 품목명 → {부류코드, 품목코드, 품종코드} (KAMIS 품목·등급 코드표 기준) */
    static final Map<String, String[]> TARGET_ITEMS = createTargetItems();

    private static final Pattern UNIT_IN_PARENS = Pattern.compile("\\(([^()]*)\\)$");

    @Value("${kamis.cert-key:test}")
    private String certKey;

    @Value("${kamis.cert-id:test}")
    private String certId;

    private final RetailPriceRepository retailPriceRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    public KamisRetailService(RetailPriceRepository retailPriceRepository) {
        this.retailPriceRepository = retailPriceRepository;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(60_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /** 대상 품목 전체를 기간 수집. 이미 있는 날은 값이 바뀌었을 때만 고친다. 저장·수정 건수를 돌려준다 */
    public int collect(LocalDate startDate, LocalDate endDate) {
        int changed = 0;
        for (String itemName : TARGET_ITEMS.keySet()) {
            changed += collectItem(itemName, startDate, endDate);
        }
        return changed;
    }

    public int collectItem(String itemName, LocalDate startDate, LocalDate endDate) {
        String[] codes = TARGET_ITEMS.get(itemName);
        if (codes == null) throw new IllegalArgumentException("수집 대상이 아닌 품목: " + itemName);

        int changed = 0;
        LocalDate today = LocalDate.now(KST);
        for (LocalDate[] chunk : yearChunks(startDate, endDate)) {
            LocalDate[] query = yearQuery(chunk[0].getYear(), today);
            String body;
            try {
                body = restTemplate.getForObject(buildUrl(codes, query[0], query[1]), String.class);
            } catch (Exception e) {
                logger.warn("KAMIS 소매 조회 실패 [{} {}~{}]: {}", itemName, chunk[0], chunk[1], e.getMessage());
                continue;
            } finally {
                sleepQuietly();
            }

            List<DailyRetail> rows;
            try {
                rows = parse(body, chunk[0], chunk[1]);
            } catch (Exception e) {
                logger.warn("KAMIS 소매 응답 파싱 실패 [{} {}~{}]: {}", itemName, chunk[0], chunk[1], e.getMessage());
                continue;
            }
            for (DailyRetail r : rows) {
                if (upsert(itemName, r)) changed++;
            }
            logger.info("KAMIS 소매 [{}] {}~{}: {}일", itemName, chunk[0], chunk[1], rows.size());
        }
        return changed;
    }

    private boolean upsert(String itemName, DailyRetail r) {
        Optional<RetailPrice> found = retailPriceRepository.findByItemNameAndPriceDate(itemName, r.date());
        RetailPrice entity = found.orElseGet(RetailPrice::new);
        if (found.isPresent()
                && Objects.equals(entity.getPrice(), r.price())
                && Objects.equals(entity.getMarketCount(), r.marketCount())) {
            return false;
        }
        entity.setItemName(itemName);
        entity.setPriceDate(r.date());
        entity.setPrice(r.price());
        entity.setUnit(r.unit());
        entity.setMarketCount(r.marketCount());
        retailPriceRepository.save(entity);
        return true;
    }

    private String buildUrl(String[] codes, LocalDate start, LocalDate end) {
        return UriComponentsBuilder.fromUriString(URL)
                .queryParam("action", "periodRetailProductList")
                .queryParam("p_startday", start.toString())
                .queryParam("p_endday", end.toString())
                .queryParam("p_itemcategorycode", codes[0])
                .queryParam("p_itemcode", codes[1])
                .queryParam("p_kindcode", codes[2])
                .queryParam("p_productrankcode", RANK_TOP)
                .queryParam("p_countrycode", SEOUL)
                .queryParam("p_convert_kg_yn", "N")
                .queryParam("p_cert_key", certKey)
                .queryParam("p_cert_id", certId)
                .queryParam("p_returntype", "json")
                .toUriString();
    }

    /** 실제로 API 에 보낼 구간: 그 해 1월 1일 ~ 12월 31일, 올해면 오늘까지 */
    static LocalDate[] yearQuery(int year, LocalDate today) {
        LocalDate end = LocalDate.of(year, 12, 31);
        return new LocalDate[]{LocalDate.of(year, 1, 1), end.isAfter(today) ? today : end};
    }

    /** 요청 구간을 달력 연도 단위로 자른다 (API 1회 최대 1년). 각 조각 안의 날짜만 저장한다 */
    static List<LocalDate[]> yearChunks(LocalDate start, LocalDate end) {
        List<LocalDate[]> chunks = new ArrayList<>();
        LocalDate from = start;
        while (!from.isAfter(end)) {
            LocalDate yearEnd = LocalDate.of(from.getYear(), 12, 31);
            LocalDate to = yearEnd.isBefore(end) ? yearEnd : end;
            chunks.add(new LocalDate[]{from, to});
            from = to.plusDays(1);
        }
        return chunks;
    }

    /**
     * 응답 JSON → 일별 서울 평균. [start, end] 밖의 날짜와 값이 "-" 인 날은 버린다.
     * 데이터가 없으면 data 가 ["001"] 같은 배열로 온다 → 빈 목록
     */
    static List<DailyRetail> parse(String body, LocalDate start, LocalDate end) throws Exception {
        JsonNode data = new ObjectMapper().readTree(body).path("data");
        if (!data.isObject()) return List.of();
        JsonNode items = data.path("item");
        if (items.isObject()) items = new ObjectMapper().createArrayNode().add(items);

        Map<LocalDate, Integer> average = new TreeMap<>();
        Map<LocalDate, Integer> markets = new HashMap<>();
        String unit = null;
        for (JsonNode it : items) {
            String county = it.path("countyname").asText("");
            LocalDate date = toDate(it.path("yyyy").asText(""), it.path("regday").asText(""));
            Integer price = toPrice(it.path("price").asText(""));
            if (date == null || price == null || date.isBefore(start) || date.isAfter(end)) continue;

            if ("평균".equals(county)) {
                average.put(date, price);
            } else if (!"평년".equals(county)) {
                markets.merge(date, 1, Integer::sum);
                if (unit == null) unit = unitOf(it.path("kindname").asText(""));
            }
        }

        List<DailyRetail> out = new ArrayList<>();
        for (Map.Entry<LocalDate, Integer> e : average.entrySet()) {
            out.add(new DailyRetail(e.getKey(), e.getValue(), unit, markets.getOrDefault(e.getKey(), 0)));
        }
        return out;
    }

    private static LocalDate toDate(String yyyy, String regday) {
        String[] md = regday.split("/");
        if (yyyy.length() != 4 || md.length != 2) return null;
        try {
            return LocalDate.of(Integer.parseInt(yyyy), Integer.parseInt(md[0]), Integer.parseInt(md[1]));
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer toPrice(String text) {
        String digits = text.replace(",", "").trim();
        if (digits.isEmpty() || digits.equals("-")) return null;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** "양파(1kg)" → "1kg", "여름(고랭지)(1포기)" → "1포기" */
    static String unitOf(String kindName) {
        Matcher m = UNIT_IN_PARENS.matcher(kindName.trim());
        return m.find() ? m.group(1) : null;
    }

    private static void sleepQuietly() {
        try {
            Thread.sleep(REQUEST_GAP_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static Map<String, String[]> createTargetItems() {
        Map<String, String[]> items = new LinkedHashMap<>();
        items.put("양파", new String[]{"200", "245", "00"});
        items.put("붉은고추", new String[]{"200", "243", "00"});
        items.put("양배추", new String[]{"200", "212", "00"});
        return Collections.unmodifiableMap(items);
    }

    record DailyRetail(LocalDate date, int price, String unit, int marketCount) {}
}
