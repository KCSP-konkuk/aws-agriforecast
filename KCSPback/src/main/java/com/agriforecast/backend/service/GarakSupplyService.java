package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.GarakSupplySoon;
import com.agriforecast.backend.repository.GarakSupplySoonRepository;
import com.agriforecast.backend.util.Soon;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 농넷 가락시장 순별 반입량(getGarakSoonList.do, soonDataType=area) → garak_supply_soon
 *
 * 작업대 '수급' 지표가 없던 품목에 가락 반입량을 붙인다. 배추 · 양파 · 양배추 · 당근 · 홍고추는 서울시농수산식품공사
 * 공공데이터(SupplyCollectService, 일별)와 레포 과거분이 있어 여기서 받지 않는다. 건고추 · 쌀 · 콩은 가락 반입량이 없다.
 * 공개 페이지라 인증이 없다. 응답 1건 = 검색일이 든 순과 그 앞 8순(9순), 값은 톤, 순마다 반입 1 · 2위 산지가 같이 온다.
 * API 동작 메모 (2026-10-06 확인)
 *  - 지난 순 값은 검색일이 순 안 어느 날이든 같다. 진행 중인 순은 어제까지 합
 *  - 값 0 · 산지 없음은 기록 없음(예: 무 2014-01 중 · 하순) → VOLUME 을 비워 두고 받은 순으로만 남긴다
 *  - 품목 묶음 코드(사과 41100, 배 41200, 마늘 24300)는 품종 합계. 깐마늘 코드(24304)는 비어 있다.
 *    파프리카는 묶음 코드(25120)가 비어 색깔별 코드를 더한다
 *  - 2013 년부터 있다. 가끔 몇 분씩 응답이 없다 → 타임아웃 + 재시도, 끝내 못 받은 구간은 다음 수집 때 다시
 */
@Service
public class GarakSupplyService {

    private static final Logger logger = LoggerFactory.getLogger(GarakSupplyService.class);

    private static final String PAGE = "https://www.nongnet.or.kr/front/M000000258/marketInfo/garak.do";
    private static final String URL = "https://www.nongnet.or.kr/front/M000000258/marketInfo/getGarakSoonList.do";
    private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final DateTimeFormatter SEARCH_DATE = DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final long REQUEST_GAP_MS = 1500;
    private static final int MAX_ATTEMPTS = 3;
    private static final int TIMEOUT_MS = 30_000;

    /** 응답 1건에 오는 순 수 */
    static final int WINDOW = 9;

    /** 받은 범위 메모 · 가락 품목 코드들(여러 개면 순마다 더한다) */
    record Garak(String scope, List<String> codes) {
        Garak(String scope, String... codes) {
            this(scope, List.of(codes));
        }
    }

    /** 작업대 품목(KamisItems 이름) → 가락 품목. 코드는 농넷 가락 화면의 품목 목록에서 확인 */
    static final Map<String, Garak> ITEMS = createItems();

    private final GarakSupplySoonRepository repository;

    public GarakSupplyService(GarakSupplySoonRepository repository) {
        this.repository = repository;
    }

    /**
     * from ~ to 의 순을 품목마다 9순씩 받는다. 저장 · 수정 건수를 돌려준다.
     * skipStored: 9순이 모두 받아져 있는 지난 구간은 요청하지 않는다(앱 재시작마다 2014~ 를 다시 받지 않게)
     */
    public int collect(LocalDate from, LocalDate to, boolean skipStored) {
        Map<String, String> cookies = sessionCookies();
        int changed = 0;
        for (String item : ITEMS.keySet()) {
            changed += collectItem(item, from, to, skipStored, cookies);
        }
        return changed;
    }

    int collectItem(String item, LocalDate from, LocalDate to, boolean skipStored, Map<String, String> cookies) {
        Garak garak = ITEMS.get(item);
        if (garak == null) throw new IllegalArgumentException("반입량 수집 대상이 아닌 품목: " + item);

        Soon current = Soon.of(LocalDate.now(KST));
        int changed = 0;
        for (Soon end : windowEnds(from, to)) {
            LocalDate first = back(end, WINDOW - 1).start();
            if (skipStored && end.start().isBefore(current.start())
                    && repository.countByItemNameAndSoonStartBetween(item, first, end.start()) >= WINDOW) {
                continue;
            }
            List<List<SoonVolume>> perCode = new ArrayList<>();
            for (String code : garak.codes()) {
                List<SoonVolume> rows = fetch(item, code, end, cookies);
                if (rows == null) break;
                perCode.add(rows);
            }
            if (perCode.size() < garak.codes().size()) continue;   // 한 코드라도 못 받으면 그 구간은 다음에
            List<SoonVolume> rows = combine(perCode);
            changed += save(item, garak.scope(), rows, first, end.start());
        }
        logger.info("가락 순별 반입량 [{}] {} ~ {}: {}건 저장 · 수정", item, from, to, changed);
        return changed;
    }

    /** to 가 든 순부터 9순씩 거슬러 from 이 든 순까지 — 각 구간의 마지막 순 */
    static List<Soon> windowEnds(LocalDate from, LocalDate to) {
        List<Soon> out = new ArrayList<>();
        LocalDate first = Soon.of(from).start();
        for (Soon s = Soon.of(to); !s.start().isBefore(first); s = back(s, WINDOW)) {
            out.add(s);
        }
        return out;
    }

    static Soon back(Soon s, int n) {
        Soon out = s;
        for (int i = 0; i < n; i++) out = out.previous();
        return out;
    }

    /** 응답 JSON → 순별 반입량. 값이 0 이면 기록 없음(VOLUME 비움, 산지도 비움) */
    static List<SoonVolume> parse(String body) throws Exception {
        JsonNode list = new ObjectMapper().readTree(body).path("datalist");
        List<SoonVolume> out = new ArrayList<>();
        for (JsonNode r : list) {
            int part = r.path("soonVal").asInt(0);
            if (part < 1 || part > 3) continue;
            LocalDate start = new Soon(r.path("year").asInt(), r.path("month").asInt(), part).start();
            double volume = r.path("selectSoon").asDouble(0);
            if (volume <= 0) {
                out.add(new SoonVolume(start, null, null, null, null, null));
                continue;
            }
            out.add(new SoonVolume(start, volume, text(r, "rank1Name"), number(r, "rank1Weight"),
                    text(r, "rank2Name"), number(r, "rank2Weight")));
        }
        return out;
    }

    /** 여러 코드를 순마다 더한다(값이 있는 코드만). 산지는 코드마다 달라 비운다 */
    static List<SoonVolume> combine(List<List<SoonVolume>> perCode) {
        if (perCode.size() == 1) return perCode.get(0);
        Map<LocalDate, Double> sum = new TreeMap<>();
        for (List<SoonVolume> rows : perCode) {
            for (SoonVolume v : rows) {
                sum.putIfAbsent(v.soonStart(), null);
                if (v.volume() != null) sum.merge(v.soonStart(), v.volume(), (a, b) -> a == null ? b : a + b);
            }
        }
        List<SoonVolume> out = new ArrayList<>();
        sum.forEach((start, volume) -> out.add(new SoonVolume(start, volume, null, null, null, null)));
        return out;
    }

    /** [first, last] 안의 순만, 바뀐 행만 고친다 */
    private int save(String item, String scope, List<SoonVolume> rows, LocalDate first, LocalDate last) {
        Map<LocalDate, GarakSupplySoon> existing = new HashMap<>();
        for (GarakSupplySoon e : repository.findByItemNameAndSoonStartBetween(item, first, last)) {
            existing.put(e.getSoonStart(), e);
        }
        List<GarakSupplySoon> dirty = new ArrayList<>();
        for (SoonVolume v : rows) {
            if (v.soonStart().isBefore(first) || v.soonStart().isAfter(last)) continue;
            GarakSupplySoon e = existing.get(v.soonStart());
            if (e != null && Objects.equals(e.getVolume(), v.volume()) && Objects.equals(e.getRank1Region(), v.rank1Region())
                    && Objects.equals(e.getRank1Volume(), v.rank1Volume()) && Objects.equals(e.getRank2Region(), v.rank2Region())
                    && Objects.equals(e.getRank2Volume(), v.rank2Volume()) && Objects.equals(e.getScope(), scope)) {
                continue;
            }
            if (e == null) e = new GarakSupplySoon();
            e.setItemName(item);
            e.setSoonStart(v.soonStart());
            e.setVolume(v.volume());
            e.setRank1Region(v.rank1Region());
            e.setRank1Volume(v.rank1Volume());
            e.setRank2Region(v.rank2Region());
            e.setRank2Volume(v.rank2Volume());
            e.setScope(scope);
            dirty.add(e);
        }
        repository.saveAll(dirty);
        return dirty.size();
    }

    /** 무응답 · 오류면 MAX_ATTEMPTS 번까지. 끝내 실패하면 null (그 구간은 다음 수집 때 다시) */
    private List<SoonVolume> fetch(String item, String code, Soon end, Map<String, String> cookies) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                String body = Jsoup.connect(URL)
                        .userAgent(UA)
                        .cookies(cookies)
                        .referrer(PAGE)
                        .header("X-Requested-With", "XMLHttpRequest")
                        .header("Accept", "application/json, text/javascript, */*; q=0.01")
                        .ignoreContentType(true)
                        .timeout(TIMEOUT_MS)
                        .data("soonDataType", "area")
                        .data("searchSoonGrade", "1")
                        .data("searchSoonGradeNm", "상")
                        .data("searchUnitCd", "1")
                        .data("searchDate", end.start().format(SEARCH_DATE))
                        .data("searchSymbol1", "garak")
                        .data("searchSymbol2", code)
                        .data("searchSymbol3", "")
                        .method(Connection.Method.GET)
                        .execute()
                        .body();
                return parse(body);
            } catch (Exception e) {
                logger.warn("가락 순별 반입량 조회 실패 [{} {} ~{}] {}/{}회: {}",
                        item, code, end.code(), attempt, MAX_ATTEMPTS, e.getMessage());
            } finally {
                sleepQuietly();
            }
        }
        return null;
    }

    /** 가락 화면을 한 번 열어 세션 쿠키를 받는다. 못 받으면 쿠키 없이 */
    private Map<String, String> sessionCookies() {
        try {
            return Jsoup.connect(PAGE).userAgent(UA).timeout(TIMEOUT_MS).method(Connection.Method.GET).execute().cookies();
        } catch (Exception e) {
            logger.warn("농넷 세션 쿠키 획득 실패 — 쿠키 없이 진행: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    private static String text(JsonNode r, String field) {
        JsonNode n = r.path(field);
        return n.isTextual() && !n.asText().isBlank() ? n.asText().trim() : null;
    }

    private static Double number(JsonNode r, String field) {
        JsonNode n = r.path(field);
        return n.isNumber() ? n.asDouble() : null;
    }

    private static void sleepQuietly() {
        try {
            Thread.sleep(REQUEST_GAP_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static Map<String, Garak> createItems() {
        Map<String, Garak> items = new LinkedHashMap<>();
        items.put("무", new Garak(null, "23100"));
        items.put("깐마늘", new Garak("마늘 전체", "24300"));           // 깐마늘 코드(24304)는 반입량이 비어 있다
        items.put("대파", new Garak(null, "24501"));                    // 대파(일반)
        items.put("오이", new Garak("백다다기", "22302"));              // 소매 다다기와 같은 품종
        items.put("애호박", new Garak(null, "22402"));
        items.put("토마토", new Garak(null, "22500"));
        items.put("풋고추", new Garak(null, "24201"));
        items.put("파프리카", new Garak("빨강 · 노랑 · 주황 · 초록 합계", "25124", "25122", "25125", "25123"));
        items.put("시금치", new Garak(null, "21300"));
        items.put("사과", new Garak(null, "41100"));                    // 품종 합계
        items.put("배", new Garak(null, "41200"));                      // 품종 합계
        items.put("감자", new Garak(null, "15200"));
        return Collections.unmodifiableMap(items);
    }

    record SoonVolume(LocalDate soonStart, Double volume, String rank1Region, Double rank1Volume,
                      String rank2Region, Double rank2Volume) {}
}
