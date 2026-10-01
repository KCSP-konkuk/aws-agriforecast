package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.RetailMarketPrice;
import com.agriforecast.backend.entity.RetailPrice;
import com.agriforecast.backend.repository.RetailMarketPriceRepository;
import com.agriforecast.backend.util.Soon;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/**
 * 홈 '서울 전통시장 소매가' 섹션 조회 (retail_market_price · retail_predictions 읽기 전용)
 * 가격 = 경동·복조리 두 전통시장의 그날 값 평균(있는 곳만). 소매 예측 모델의 목표와 같은 기준이다.
 *   서울 평균(retail_price)은 대형유통이 섞여 판매처 구성이 바뀔 때 출렁여서 쓰지 않는다 (redpepper docs/RETAIL.md)
 * 순: 1~10일 상순 / 11~20일 중순 / 21일~ 하순 — 예측 모델과 같은 규칙
 */
@Service
public class RetailPriceService {

    /**
     * 홈 차트에 보이는 기간 — 수집은 2014~ 이지만 홈은 최근만 (이전 동작: 2025-01~ 만 있었음).
     * 카드 증감(직전 순 평균)은 이 기간 안에서 계산해도 같다
     */
    static final int CHART_YEARS = 2;

    static final List<String> MARKETS = List.of("경동", "복조리");

    /** 예측 배치(pipeline_retail.py)가 쓰는 테이블. 품목 모델이 없으면 행이 없다 */
    static final String PREDICTION_TABLE = "retail_predictions";

    /** 조사 단위 — 데이터가 없는 품목에도 카드에 단위를 보이려고 고정해 둔다 */
    static final Map<String, String> UNITS = Map.of("양파", "1kg", "붉은고추", "100g", "양배추", "1포기",
            "애호박", "1개", "시금치", "100g");

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final RetailMarketPriceRepository marketPriceRepository;
    private final JdbcTemplate jdbcTemplate;

    public RetailPriceService(RetailMarketPriceRepository marketPriceRepository, JdbcTemplate jdbcTemplate) {
        this.marketPriceRepository = marketPriceRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Summary> summary() {
        List<Summary> out = new ArrayList<>();
        Soon now = Soon.of(LocalDate.now(KST));
        for (String item : KamisRetailService.TARGET_ITEMS.keySet()) {
            Summary s = summarize(item, UNITS.get(item), recentRows(item));
            Prediction p = prediction(item, now);
            out.add(p == null ? s : new Summary(s.itemName(), s.unit(), s.latestDate(), s.latestPrice(),
                    s.prevSoonAvg(), s.changePct(), p));
        }
        return out;
    }

    public Series series(String itemName, String unit) {
        if (!KamisRetailService.TARGET_ITEMS.containsKey(itemName)) {
            throw new IllegalArgumentException("소매가 대상이 아닌 품목: " + itemName);
        }
        List<RetailPrice> rows = recentRows(itemName);
        List<Point> points = switch (unit) {
            case "daily" -> rows.stream()
                    .map(r -> new Point(r.getPriceDate(), r.getPriceDate().toString(), r.getPrice(), 1))
                    .toList();
            case "soon" -> soonAverages(rows);
            default -> throw new IllegalArgumentException("unit 은 daily 또는 soon: " + unit);
        };
        List<Point> predictions = List.of();
        if ("soon".equals(unit)) {
            Prediction p = prediction(itemName, Soon.of(LocalDate.now(KST)));
            if (p != null) {
                LocalDate start = Soon.parse(p.target()).start();
                predictions = List.of(new Point(start, soonLabel(start), p.price(), 0));
            }
        }
        return new Series(itemName, UNITS.get(itemName), points, predictions);
    }

    /** 진행 중인 순(또는 그 뒤)의 예측 중 가장 이른 것. 테이블이 아직 없거나 행이 없으면 null */
    private Prediction prediction(String itemName, Soon now) {
        try {
            List<Prediction> found = jdbcTemplate.query(
                    "SELECT target_date, predicted_price FROM " + PREDICTION_TABLE
                            + " WHERE item_name = ? AND target_date >= ? ORDER BY target_date LIMIT 1",
                    (rs, i) -> new Prediction(rs.getString(1), (int) Math.round(rs.getDouble(2))),
                    itemName, now.code());
            return found.isEmpty() ? null : found.get(0);
        } catch (DataAccessException e) {
            return null;
        }
    }

    private List<RetailPrice> recentRows(String itemName) {
        return dailyAverage(itemName, marketPriceRepository
                .findByItemNameAndMarketNameInAndPriceDateGreaterThanEqualOrderByPriceDateAsc(
                        itemName, MARKETS, chartFrom(LocalDate.now(KST))));
    }

    /** 판매처별 행 → 날짜별 평균(그날 값이 있는 판매처만, 반올림). marketCount = 평균에 든 판매처 수 */
    static List<RetailPrice> dailyAverage(String itemName, List<RetailMarketPrice> rows) {
        Map<LocalDate, List<Integer>> byDate = new TreeMap<>();
        for (RetailMarketPrice r : rows) {
            byDate.computeIfAbsent(r.getPriceDate(), k -> new ArrayList<>()).add(r.getPrice());
        }
        List<RetailPrice> out = new ArrayList<>();
        byDate.forEach((date, prices) -> {
            RetailPrice p = new RetailPrice();
            p.setItemName(itemName);
            p.setPriceDate(date);
            p.setPrice((int) Math.round(prices.stream().mapToInt(Integer::intValue).average().orElse(0)));
            p.setUnit(UNITS.get(itemName));
            p.setMarketCount(prices.size());
            out.add(p);
        });
        return out;
    }

    /** 오늘로부터 CHART_YEARS 년 전 달의 1일 — 순 평균이 잘리지 않게 달 첫날로 맞춘다 */
    static LocalDate chartFrom(LocalDate today) {
        return today.minusYears(CHART_YEARS).withDayOfMonth(1);
    }

    static Summary summarize(String itemName, String unit, List<RetailPrice> rows) {
        if (rows.isEmpty()) return new Summary(itemName, unit, null, null, null, null, null);

        RetailPrice latest = rows.get(rows.size() - 1);
        LocalDate prevStart = previousSoonStart(latest.getPriceDate());
        Integer prevAvg = soonAverages(rows).stream()
                .filter(p -> p.date().equals(prevStart))
                .map(Point::price)
                .findFirst().orElse(null);
        Double changePct = prevAvg == null ? null
                : Math.round((latest.getPrice() - prevAvg) * 1000.0 / prevAvg) / 10.0;
        return new Summary(itemName, unit, latest.getPriceDate(), latest.getPrice(), prevAvg, changePct, null);
    }

    /** 날짜순 일별 → 순별 평균 (조사일이 있는 순만) */
    static List<Point> soonAverages(List<RetailPrice> rows) {
        Map<LocalDate, List<Integer>> bySoon = new TreeMap<>();
        for (RetailPrice r : rows) {
            bySoon.computeIfAbsent(soonStart(r.getPriceDate()), k -> new ArrayList<>()).add(r.getPrice());
        }
        List<Point> out = new ArrayList<>();
        bySoon.forEach((start, prices) -> {
            double avg = prices.stream().mapToInt(Integer::intValue).average().orElse(0);
            out.add(new Point(start, soonLabel(start), (int) Math.round(avg), prices.size()));
        });
        return out;
    }

    static LocalDate soonStart(LocalDate d) {
        return Soon.of(d).start();
    }

    static LocalDate previousSoonStart(LocalDate d) {
        return Soon.of(d).previous().start();
    }

    /** 차트 라벨 "2026-09 상순" (Soon.label 은 "9월 상순" — 연도가 필요해 따로 둔다) */
    static String soonLabel(LocalDate d) {
        Soon s = Soon.of(d);
        return String.format("%d-%02d %s", s.year(), s.month(), s.code().substring(6));
    }

    public record Point(LocalDate date, String label, int price, int days) {}

    /** target: 예측 대상 순 코드 "202610상순", price: 그 순 경동·복조리 평균 예측(원) */
    public record Prediction(String target, int price) {}

    /** prediction: 소매 예측 모델이 있는 품목만 채운다(없으면 null) */
    public record Summary(String itemName, String unit, LocalDate latestDate, Integer latestPrice,
                          Integer prevSoonAvg, Double changePct, Prediction prediction) {}

    /** predictions: 순별에서만, 예측이 있으면 대상 순 1점 */
    public record Series(String itemName, String unit, List<Point> points, List<Point> predictions) {}
}
