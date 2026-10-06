package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.WholesaleMarketPrice;
import com.agriforecast.backend.repository.WholesaleMarketPriceRepository;
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

/**
 * KAMIS Open API「신) 일별 품목별 도매 가격자료」(periodWholesaleProductList) → wholesale_market_price
 *
 * 서울(1101) · 상품(04) 등급. 서울 시장은 품목마다 한 곳 — 대부분 '가락도매'(가락시장 중도매인 판매가), 쌀은 '양곡도매'.
 * 응답 모양은 소매(17번)와 같다('평균'·'평년' 행 + 시장별 행) → 파싱 · 연 단위 조회 · 품종 잇기는 KamisRetailService 것을 쓴다.
 * 품목은 소매와 같다(KamisItems.WHOLESALE). 작업대 도매가 지표가 되고, 소매 예측(pipeline_retail.py)은 농넷 가락 경매가가
 * 없는 품목(애호박 · 시금치 · 오이 · 파프리카)의 가락 자리에 쓴다 (model-research docs/RETAIL.md 12절)
 * 게시 시각: 9/30 값이 당일 15:25~15:55 KST 사이에 올라왔다(1회 관측) → 17:30 수집이면 다음 날 12:10 예측에 들어간다
 */
@Service
public class KamisWholesaleService {

    private static final Logger logger = LoggerFactory.getLogger(KamisWholesaleService.class);

    private static final String URL = "https://www.kamis.or.kr/service/price/xml.do";
    private static final String SEOUL = "1101";
    private static final String RANK_TOP = "04";   // 상품
    private static final long REQUEST_GAP_MS = 1000;
    private static final int MAX_ATTEMPTS = 3;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 품목명 → 코드 (KamisItems.WHOLESALE) */
    static final Map<String, KamisItems.Codes> TARGET_ITEMS = KamisItems.WHOLESALE;

    @Value("${kamis.cert-key:test}")
    private String certKey;

    @Value("${kamis.cert-id:test}")
    private String certId;

    private final WholesaleMarketPriceRepository repository;
    private final RestTemplate restTemplate;

    public KamisWholesaleService(WholesaleMarketPriceRepository repository) {
        this.repository = repository;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(60_000);
        this.restTemplate = new RestTemplate(factory);
    }

    public int collect(LocalDate startDate, LocalDate endDate) {
        return collect(startDate, endDate, false);
    }

    /** skipStoredYears: 값이 이미 있는 지난 해는 요청하지 않는다. 올해는 항상 받는다 */
    public int collect(LocalDate startDate, LocalDate endDate, boolean skipStoredYears) {
        int changed = 0;
        for (String itemName : TARGET_ITEMS.keySet()) {
            changed += collectItem(itemName, startDate, endDate, skipStoredYears);
        }
        return changed;
    }

    public int collectItem(String itemName, LocalDate startDate, LocalDate endDate, boolean skipStoredYears) {
        KamisItems.Codes codes = TARGET_ITEMS.get(itemName);
        if (codes == null) throw new IllegalArgumentException("도매 수집 대상이 아닌 품목: " + itemName);

        int changed = 0;
        LocalDate today = LocalDate.now(KST);
        for (LocalDate[] chunk : KamisRetailService.yearChunks(startDate, endDate)) {
            if (skipStoredYears && chunk[0].getYear() < today.getYear()
                    && repository.existsByItemNameAndPriceDateBetween(itemName, chunk[0], chunk[1])) {
                continue;
            }
            LocalDate[] query = KamisRetailService.yearQuery(chunk[0].getYear(), today);
            KamisRetailService.KindRows year = fetchKinds(itemName, codes, query);
            if (year == null) continue;

            List<KamisRetailService.MarketRetail> rows =
                    KamisRetailService.within(year.markets(), KamisRetailService.MarketRetail::date, chunk);
            changed += save(itemName, rows, units(year.averages()), chunk);
            logger.info("KAMIS 도매 [{}] {}~{}: 시장별 {}건", itemName, chunk[0], chunk[1], rows.size());
        }
        return changed;
    }

    /** 품종마다 그 해를 받아 잇는다. 한 품종이라도 끝내 못 받으면 null (그 해는 통째로 다음 수집 때 다시) */
    private KamisRetailService.KindRows fetchKinds(String itemName, KamisItems.Codes codes, LocalDate[] query) {
        List<KamisRetailService.KindRows> perKind = new ArrayList<>();
        for (String kind : codes.kinds()) {
            String body = fetch(itemName, codes, kind, query);
            if (body == null) return null;
            try {
                perKind.add(new KamisRetailService.KindRows(KamisRetailService.parse(body, query[0], query[1]),
                        KamisRetailService.parseMarkets(body, query[0], query[1])));
            } catch (Exception e) {
                logger.warn("KAMIS 도매 응답 파싱 실패 [{} {} {}~{}]: {}", itemName, kind, query[0], query[1], e.getMessage());
                return null;
            }
        }
        return KamisRetailService.mergeKinds(perKind);
    }

    /** 날짜 → 거래 단위 (그날 쓴 품종의 품종명에서, 예: 20kg · 10kg(그물망 3포기)) */
    static NavigableMap<LocalDate, String> units(List<KamisRetailService.DailyRetail> averages) {
        NavigableMap<LocalDate, String> out = new TreeMap<>();
        for (KamisRetailService.DailyRetail r : averages) {
            if (r.unit() != null) out.put(r.date(), r.unit());
        }
        return out;
    }

    /** 무응답·오류면 MAX_ATTEMPTS 번까지 다시 요청. 끝내 실패하면 null (그 해는 건너뛰고 다음 수집 때 다시) */
    private String fetch(String itemName, KamisItems.Codes codes, String kind, LocalDate[] query) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return restTemplate.getForObject(buildUrl(codes, kind, query[0], query[1]), String.class);
            } catch (Exception e) {
                logger.warn("KAMIS 도매 조회 실패 [{} {} {}~{}] {}/{}회: {}",
                        itemName, kind, query[0], query[1], attempt, MAX_ATTEMPTS, e.getMessage());
            } finally {
                sleepQuietly();
            }
        }
        return null;
    }

    /** 값이나 단위가 바뀐 행만 고친다. 평균 행이 없는 날의 단위는 가까운 날 것 */
    private int save(String itemName, List<KamisRetailService.MarketRetail> rows, NavigableMap<LocalDate, String> units,
                     LocalDate[] chunk) {
        Map<String, WholesaleMarketPrice> existing = new HashMap<>();
        for (WholesaleMarketPrice p : repository.findByItemNameAndPriceDateBetween(itemName, chunk[0], chunk[1])) {
            existing.put(p.getPriceDate() + "|" + p.getMarketName(), p);
        }
        List<WholesaleMarketPrice> dirty = new ArrayList<>();
        for (KamisRetailService.MarketRetail r : rows) {
            Map.Entry<LocalDate, String> known = units.floorEntry(r.date());
            if (known == null) known = units.ceilingEntry(r.date());
            String unit = known == null ? null : known.getValue();
            WholesaleMarketPrice entity = existing.get(r.date() + "|" + r.market());
            if (entity != null && Objects.equals(entity.getPrice(), r.price()) && Objects.equals(entity.getUnit(), unit)) {
                continue;
            }
            if (entity == null) entity = new WholesaleMarketPrice();
            entity.setItemName(itemName);
            entity.setPriceDate(r.date());
            entity.setMarketName(r.market());
            entity.setPrice(r.price());
            entity.setUnit(unit);
            dirty.add(entity);
        }
        repository.saveAll(dirty);
        return dirty.size();
    }

    private String buildUrl(KamisItems.Codes codes, String kind, LocalDate start, LocalDate end) {
        return UriComponentsBuilder.fromUriString(URL)
                .queryParam("action", "periodWholesaleProductList")
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

    private static void sleepQuietly() {
        try {
            Thread.sleep(REQUEST_GAP_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
