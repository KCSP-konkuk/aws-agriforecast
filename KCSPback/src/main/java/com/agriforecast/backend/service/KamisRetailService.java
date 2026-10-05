package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.RetailMarketPrice;
import com.agriforecast.backend.entity.RetailPrice;
import com.agriforecast.backend.repository.RetailMarketPriceRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;

/**
 * KAMIS Open API「신) 일별 품목별 소매 가격자료」(periodRetailProductList)
 *   → retail_price(서울 평균) + retail_market_price(서울 판매처별)
 *
 * 서울(1101) · 상품(04) 등급. 응답의 '평균' 행이 서울 판매처 값의 평균, 나머지 행이 판매처별 값이다.
 * API 동작 메모 (2026-09-28 확인)
 *  - p_kindcode·p_countrycode 를 비우면 에러 대신 응답이 오지 않는다
 *  - 1회 조회는 최대 1년이고 과거 1년 구간도 받을 수 있다(2014~2026 연 단위 두 번 받아 일치).
 *    요청 시작일보다 이른 날짜(그 품종 조사 시작일부터)가 섞여 오기도 한다
 *  - 같은 요청이 가끔 에러 없이 응답이 안 오다가(60초+) 나중엔 온다 → 읽기 타임아웃 + 연도별 재시도
 *  - 짧은 구간(예: 2026-09-01~09-23)이 더 자주 멈췄고 '1월 1일 ~ 연말(올해는 오늘)' 통째 조회는
 *    대체로 왔다 → 항상 연 단위로 받아 원하는 구간만 남긴다
 *  - 값이 없는 날은 "-"
 * 품목 · 품종 코드는 KamisItems. 철마다 품종이 바뀌는 품목은 품종마다 받아 한 줄로 잇는다(mergeKinds)
 */
@Service
public class KamisRetailService {

    private static final Logger logger = LoggerFactory.getLogger(KamisRetailService.class);

    private static final String URL = "https://www.kamis.or.kr/service/price/xml.do";
    private static final String SEOUL = "1101";
    private static final String RANK_TOP = "04";   // 상품
    private static final long REQUEST_GAP_MS = 1000;
    private static final int MAX_ATTEMPTS = 3;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 품목명 → 코드 (KamisItems.RETAIL) */
    static final Map<String, KamisItems.Codes> TARGET_ITEMS = KamisItems.RETAIL;

    /** 같은 품종 조사가 이만큼 넘게 끊기면 다음 철로 본다 */
    static final int SEASON_GAP_DAYS = 30;

    @Value("${kamis.cert-key:test}")
    private String certKey;

    @Value("${kamis.cert-id:test}")
    private String certId;

    private final RetailPriceRepository retailPriceRepository;
    private final RetailMarketPriceRepository marketPriceRepository;
    private final RestTemplate restTemplate;

    public KamisRetailService(RetailPriceRepository retailPriceRepository,
                              RetailMarketPriceRepository marketPriceRepository) {
        this.retailPriceRepository = retailPriceRepository;
        this.marketPriceRepository = marketPriceRepository;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(60_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /** 대상 품목 전체를 기간 수집. 이미 있는 날은 값이 바뀌었을 때만 고친다. 저장·수정 건수를 돌려준다 */
    public int collect(LocalDate startDate, LocalDate endDate) {
        return collect(startDate, endDate, false);
    }

    /**
     * skipStoredYears: 지난 해 중 판매처별 값이 이미 있는 해는 요청하지 않는다 (앱 재시작마다 13년치를 다시 받지 않게).
     * 올해는 항상 받는다
     */
    public int collect(LocalDate startDate, LocalDate endDate, boolean skipStoredYears) {
        int changed = 0;
        for (String itemName : TARGET_ITEMS.keySet()) {
            changed += collectItem(itemName, startDate, endDate, skipStoredYears);
        }
        return changed;
    }

    public int collectItem(String itemName, LocalDate startDate, LocalDate endDate, boolean skipStoredYears) {
        KamisItems.Codes codes = TARGET_ITEMS.get(itemName);
        if (codes == null) throw new IllegalArgumentException("수집 대상이 아닌 품목: " + itemName);

        int changed = 0;
        LocalDate today = LocalDate.now(KST);
        for (LocalDate[] chunk : yearChunks(startDate, endDate)) {
            if (skipStoredYears && chunk[0].getYear() < today.getYear()
                    && marketPriceRepository.existsByItemNameAndPriceDateBetween(itemName, chunk[0], chunk[1])) {
                continue;
            }
            LocalDate[] query = yearQuery(chunk[0].getYear(), today);
            KindRows year = fetchKinds(itemName, codes, query);
            if (year == null) continue;

            List<DailyRetail> rows = within(year.averages(), DailyRetail::date, chunk);
            List<MarketRetail> markets = within(year.markets(), MarketRetail::date, chunk);
            changed += saveAverages(itemName, rows, chunk);
            changed += saveMarkets(itemName, markets, chunk);
            logger.info("KAMIS 소매 [{}] {}~{}: {}일, 판매처별 {}건", itemName, chunk[0], chunk[1], rows.size(), markets.size());
        }
        return changed;
    }

    /**
     * 품종마다 그 해를 받아 잇는다. 한 품종이라도 끝내 못 받으면 null — 그 해는 통째로 다음 수집 때 다시
     * (일부 품종만 저장하면 지난 해 건너뛰기에 걸려 그 철이 빈 채로 남는다)
     */
    private KindRows fetchKinds(String itemName, KamisItems.Codes codes, LocalDate[] query) {
        List<KindRows> perKind = new ArrayList<>();
        for (String kind : codes.kinds()) {
            String body = fetch(itemName, codes, kind, query);
            if (body == null) return null;
            try {
                perKind.add(new KindRows(parse(body, query[0], query[1]), parseMarkets(body, query[0], query[1])));
            } catch (Exception e) {
                logger.warn("KAMIS 소매 응답 파싱 실패 [{} {} {}~{}]: {}", itemName, kind, query[0], query[1], e.getMessage());
                return null;
            }
        }
        return mergeKinds(perKind);
    }

    /** 무응답·오류면 MAX_ATTEMPTS 번까지 다시 요청. 끝내 실패하면 null (그 해는 건너뛰고 다음 수집 때 다시) */
    private String fetch(String itemName, KamisItems.Codes codes, String kind, LocalDate[] query) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return restTemplate.getForObject(buildUrl(codes, kind, query[0], query[1]), String.class);
            } catch (Exception e) {
                logger.warn("KAMIS 소매 조회 실패 [{} {} {}~{}] {}/{}회: {}",
                        itemName, kind, query[0], query[1], attempt, MAX_ATTEMPTS, e.getMessage());
            } finally {
                sleepQuietly();
            }
        }
        return null;
    }

    private int saveAverages(String itemName, List<DailyRetail> rows, LocalDate[] chunk) {
        Map<LocalDate, RetailPrice> existing = new HashMap<>();
        for (RetailPrice p : retailPriceRepository.findByItemNameAndPriceDateBetweenOrderByPriceDateAsc(itemName, chunk[0], chunk[1])) {
            existing.put(p.getPriceDate(), p);
        }
        List<RetailPrice> dirty = new ArrayList<>();
        for (DailyRetail r : rows) {
            RetailPrice entity = existing.get(r.date());
            if (entity != null
                    && Objects.equals(entity.getPrice(), r.price())
                    && Objects.equals(entity.getMarketCount(), r.marketCount())) {
                continue;
            }
            if (entity == null) entity = new RetailPrice();
            entity.setItemName(itemName);
            entity.setPriceDate(r.date());
            entity.setPrice(r.price());
            entity.setUnit(r.unit());
            entity.setMarketCount(r.marketCount());
            dirty.add(entity);
        }
        retailPriceRepository.saveAll(dirty);
        return dirty.size();
    }

    private int saveMarkets(String itemName, List<MarketRetail> rows, LocalDate[] chunk) {
        Map<String, RetailMarketPrice> existing = new HashMap<>();
        for (RetailMarketPrice p : marketPriceRepository.findByItemNameAndPriceDateBetween(itemName, chunk[0], chunk[1])) {
            existing.put(p.getPriceDate() + "|" + p.getMarketName(), p);
        }
        List<RetailMarketPrice> dirty = new ArrayList<>();
        for (MarketRetail r : rows) {
            RetailMarketPrice entity = existing.get(r.date() + "|" + r.market());
            if (entity != null && Objects.equals(entity.getPrice(), r.price())) continue;
            if (entity == null) entity = new RetailMarketPrice();
            entity.setItemName(itemName);
            entity.setPriceDate(r.date());
            entity.setMarketName(r.market());
            entity.setPrice(r.price());
            dirty.add(entity);
        }
        marketPriceRepository.saveAll(dirty);
        return dirty.size();
    }

    private String buildUrl(KamisItems.Codes codes, String kind, LocalDate start, LocalDate end) {
        return UriComponentsBuilder.fromUriString(URL)
                .queryParam("action", "periodRetailProductList")
                .queryParam("p_startday", start.toString())
                .queryParam("p_endday", end.toString())
                .queryParam("p_itemcategorycode", codes.category())
                .queryParam("p_itemcode", codes.item())
                .queryParam("p_kindcode", kind)
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

    /** 응답 JSON → 일별 서울 판매처별 값. [start, end] 밖, 값이 "-" 인 행, 판매처명이 없는 행은 버린다 */
    static List<MarketRetail> parseMarkets(String body, LocalDate start, LocalDate end) throws Exception {
        JsonNode data = new ObjectMapper().readTree(body).path("data");
        if (!data.isObject()) return List.of();
        JsonNode items = data.path("item");
        if (items.isObject()) items = new ObjectMapper().createArrayNode().add(items);

        List<MarketRetail> out = new ArrayList<>();
        for (JsonNode it : items) {
            String county = it.path("countyname").asText("");
            String market = it.path("marketname").isTextual() ? it.path("marketname").asText().trim() : "";
            if ("평균".equals(county) || "평년".equals(county) || market.isEmpty()) continue;
            LocalDate date = toDate(it.path("yyyy").asText(""), it.path("regday").asText(""));
            Integer price = toPrice(it.path("price").asText(""));
            if (date == null || price == null || date.isBefore(start) || date.isAfter(end)) continue;
            out.add(new MarketRetail(date, market, price));
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

    /** "양파(1kg)" → "1kg", "여름(고랭지)(1포기)" → "1포기", 도매 "여름(고랭지)(10kg(그물망 3포기))" → "10kg(그물망 3포기)" */
    static String unitOf(String kindName) {
        String s = kindName.trim();
        if (!s.endsWith(")")) return null;
        int depth = 0;
        for (int i = s.length() - 1; i >= 0; i--) {
            char c = s.charAt(i);
            if (c == ')') {
                depth++;
            } else if (c == '(' && --depth == 0) {
                String unit = s.substring(i + 1, s.length() - 1).trim();
                return unit.isEmpty() ? null : unit;
            }
        }
        return null;
    }

    /**
     * 철마다 바뀌는 품종(배추 봄 · 여름(고랭지) · 가을 · 월동 등, 단위가 같다)을 한 품목으로 잇는다.
     * 같은 날 같은 판매처(평균 행 포함)에 두 품종 값이 있으면 그 철 조사가 늦게 시작된 품종 — 새로 나온 작기 — 을 쓴다.
     * 철 = 조사가 SEASON_GAP_DAYS 넘게 끊기지 않고 이어진 구간. 시작이 같으면 더 오래 이어지는 쪽, 그래도 같으면 앞 품종.
     * 2023~2025 서울 조사에서 품종끼리 겹친 날은 한 해 0~42일(대부분 열흘 안)이고, 이어 붙이면 조사일이 빠짐없이 찬다
     */
    static KindRows mergeKinds(List<KindRows> perKind) {
        if (perKind.size() == 1) return perKind.get(0);
        List<Map<LocalDate, LocalDate[]>> seasons = new ArrayList<>();
        for (KindRows k : perKind) {
            SortedSet<LocalDate> dates = new TreeSet<>();
            k.averages().forEach(r -> dates.add(r.date()));
            k.markets().forEach(r -> dates.add(r.date()));
            seasons.add(seasonsOf(dates));
        }
        List<List<DailyRetail>> averages = new ArrayList<>();
        List<List<MarketRetail>> markets = new ArrayList<>();
        perKind.forEach(k -> {
            averages.add(k.averages());
            markets.add(k.markets());
        });
        return new KindRows(pickNewer(averages, DailyRetail::date, r -> "", seasons),
                pickNewer(markets, MarketRetail::date, MarketRetail::market, seasons));
    }

    /** 조사일들 → 날짜마다 그 날이 든 철 {시작, 끝} */
    static Map<LocalDate, LocalDate[]> seasonsOf(SortedSet<LocalDate> dates) {
        Map<LocalDate, LocalDate[]> out = new HashMap<>();
        List<LocalDate> run = new ArrayList<>();
        for (LocalDate d : dates) {
            if (!run.isEmpty() && ChronoUnit.DAYS.between(run.get(run.size() - 1), d) > SEASON_GAP_DAYS) {
                closeSeason(run, out);
            }
            run.add(d);
        }
        closeSeason(run, out);
        return out;
    }

    private static void closeSeason(List<LocalDate> run, Map<LocalDate, LocalDate[]> out) {
        if (run.isEmpty()) return;
        LocalDate[] span = {run.get(0), run.get(run.size() - 1)};
        run.forEach(d -> out.put(d, span));
        run.clear();
    }

    /** (날짜, 판매처)마다 새 철 품종의 행 하나만 남긴다. 결과는 날짜 · 판매처 순 */
    private static <T> List<T> pickNewer(List<List<T>> perKind, Function<T, LocalDate> dateOf,
                                         Function<T, String> marketOf, List<Map<LocalDate, LocalDate[]>> seasons) {
        Map<LocalDate, Map<String, Integer>> owner = new TreeMap<>();
        Map<LocalDate, Map<String, T>> chosen = new TreeMap<>();
        for (int i = 0; i < perKind.size(); i++) {
            for (T row : perKind.get(i)) {
                LocalDate date = dateOf.apply(row);
                String market = marketOf.apply(row);
                Integer current = owner.computeIfAbsent(date, d -> new TreeMap<>()).get(market);
                if (current == null || isNewer(seasons.get(i).get(date), seasons.get(current).get(date))) {
                    owner.get(date).put(market, i);
                    chosen.computeIfAbsent(date, d -> new TreeMap<>()).put(market, row);
                }
            }
        }
        List<T> out = new ArrayList<>();
        chosen.values().forEach(byMarket -> out.addAll(byMarket.values()));
        return out;
    }

    private static boolean isNewer(LocalDate[] season, LocalDate[] than) {
        int byStart = season[0].compareTo(than[0]);
        return byStart != 0 ? byStart > 0 : season[1].isAfter(than[1]);
    }

    /** [chunk 시작, 끝] 안의 행만 */
    static <T> List<T> within(List<T> rows, Function<T, LocalDate> dateOf, LocalDate[] chunk) {
        return rows.stream()
                .filter(r -> !dateOf.apply(r).isBefore(chunk[0]) && !dateOf.apply(r).isAfter(chunk[1]))
                .toList();
    }

    private static void sleepQuietly() {
        try {
            Thread.sleep(REQUEST_GAP_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    record DailyRetail(LocalDate date, int price, String unit, int marketCount) {}

    record MarketRetail(LocalDate date, String market, int price) {}

    /** 품종 하나(또는 이어 붙인 결과)의 서울 평균 · 판매처별 값 */
    record KindRows(List<DailyRetail> averages, List<MarketRetail> markets) {}
}
