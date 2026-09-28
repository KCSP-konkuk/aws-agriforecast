package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.RetailPrice;
import com.agriforecast.backend.repository.RetailPriceRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/**
 * 홈 '서울 농산물 소매가' 섹션 조회 (retail_price 읽기 전용)
 * 순: 1~10일 상순 / 11~20일 중순 / 21일~ 하순 — 예측 모델과 같은 규칙
 */
@Service
public class RetailPriceService {

    /** 조사 단위 — 데이터가 없는 품목에도 카드에 단위를 보이려고 고정해 둔다 */
    static final Map<String, String> UNITS = Map.of("양파", "1kg", "붉은고추", "100g", "양배추", "1포기");

    private final RetailPriceRepository retailPriceRepository;

    public RetailPriceService(RetailPriceRepository retailPriceRepository) {
        this.retailPriceRepository = retailPriceRepository;
    }

    public List<Summary> summary() {
        List<Summary> out = new ArrayList<>();
        for (String item : KamisRetailService.TARGET_ITEMS.keySet()) {
            out.add(summarize(item, UNITS.get(item), retailPriceRepository.findByItemNameOrderByPriceDateAsc(item)));
        }
        return out;
    }

    public Series series(String itemName, String unit) {
        if (!KamisRetailService.TARGET_ITEMS.containsKey(itemName)) {
            throw new IllegalArgumentException("소매가 대상이 아닌 품목: " + itemName);
        }
        List<RetailPrice> rows = retailPriceRepository.findByItemNameOrderByPriceDateAsc(itemName);
        List<Point> points = switch (unit) {
            case "daily" -> rows.stream()
                    .map(r -> new Point(r.getPriceDate(), r.getPriceDate().toString(), r.getPrice(), 1))
                    .toList();
            case "soon" -> soonAverages(rows);
            default -> throw new IllegalArgumentException("unit 은 daily 또는 soon: " + unit);
        };
        return new Series(itemName, UNITS.get(itemName), points, List.of());
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
        int day = d.getDayOfMonth() <= 10 ? 1 : d.getDayOfMonth() <= 20 ? 11 : 21;
        return d.withDayOfMonth(day);
    }

    static LocalDate previousSoonStart(LocalDate d) {
        LocalDate start = soonStart(d);
        return switch (start.getDayOfMonth()) {
            case 1 -> start.minusMonths(1).withDayOfMonth(21);
            case 11 -> start.withDayOfMonth(1);
            default -> start.withDayOfMonth(11);
        };
    }

    static String soonLabel(LocalDate d) {
        int day = soonStart(d).getDayOfMonth();
        String name = day == 1 ? "상순" : day == 11 ? "중순" : "하순";
        return String.format("%d-%02d %s", d.getYear(), d.getMonthValue(), name);
    }

    public record Point(LocalDate date, String label, int price, int days) {}

    /** prediction: 소매 예측 모델이 생기면 {target, price}. 지금은 항상 null */
    public record Summary(String itemName, String unit, LocalDate latestDate, Integer latestPrice,
                          Integer prevSoonAvg, Double changePct, Object prediction) {}

    /** predictions: 순별에서만 채운다. 지금은 빈 목록 */
    public record Series(String itemName, String unit, List<Point> points, List<Point> predictions) {}
}
