package com.agriforecast.backend.service;

import com.agriforecast.backend.service.KamisRetailService.DailyRetail;
import com.agriforecast.backend.service.KamisRetailService.KindRows;
import com.agriforecast.backend.service.KamisRetailService.MarketRetail;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** 철마다 바뀌는 품종을 한 품목으로 잇기 (KamisRetailService.mergeKinds). 외부 의존 없음 */
class KamisKindMergeTest {

    private static LocalDate d(int month, int day) {
        return LocalDate.of(2025, month, day);
    }

    /** from 부터 to 까지 매일 값이 있는 품종 — 서울 평균 + 주어진 판매처들 */
    private static KindRows kind(LocalDate from, LocalDate to, int price, String... markets) {
        List<DailyRetail> averages = new ArrayList<>();
        List<MarketRetail> rows = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            averages.add(new DailyRetail(day, price, "1포기", markets.length));
            for (String m : markets) rows.add(new MarketRetail(day, m, price));
        }
        return new KindRows(averages, rows);
    }

    private static KindRows concat(KindRows a, KindRows b) {
        List<DailyRetail> averages = new ArrayList<>(a.averages());
        averages.addAll(b.averages());
        List<MarketRetail> markets = new ArrayList<>(a.markets());
        markets.addAll(b.markets());
        return new KindRows(averages, markets);
    }

    private static int average(KindRows rows, LocalDate day) {
        return rows.averages().stream().filter(r -> r.date().equals(day)).findFirst().orElseThrow().price();
    }

    private static int market(KindRows rows, LocalDate day, String market) {
        return rows.markets().stream().filter(r -> r.date().equals(day) && r.market().equals(market))
                .findFirst().orElseThrow().price();
    }

    @Test
    void 겹치는_날은_늦게_시작한_철의_품종을_쓰고_조사일은_빠짐없이_남는다() {
        KindRows spring = kind(d(5, 10), d(7, 20), 3000, "경동");   // 배추 봄
        KindRows winter = kind(d(1, 2), d(5, 20), 5000, "경동");    // 배추 월동 — 5/10~5/20 이 겹친다

        KindRows merged = KamisRetailService.mergeKinds(List.of(spring, winter));

        assertEquals(200, merged.averages().size());   // 1/2 ~ 7/20, 하루에 한 행
        assertEquals(200, merged.markets().size());
        assertEquals(5000, average(merged, d(5, 9)));
        assertEquals(3000, average(merged, d(5, 10)));
        assertEquals(3000, market(merged, d(5, 20), "경동"));
        assertEquals(d(1, 2), merged.averages().get(0).date());   // 날짜 순
        assertEquals(d(7, 20), merged.averages().get(199).date());
    }

    @Test
    void 품종_순서와_상관없이_같다() {
        KindRows spring = kind(d(5, 10), d(7, 20), 3000, "경동");
        KindRows winter = kind(d(1, 2), d(5, 20), 5000, "경동");

        assertEquals(KamisRetailService.mergeKinds(List.of(spring, winter)),
                KamisRetailService.mergeKinds(List.of(winter, spring)));
    }

    @Test
    void 조사가_30일_넘게_끊기면_새_철이다() {
        // 사과 후지: 1/2~8/10 뒤 10/25~ 다시(새 작기), 홍로: 8/20~10/31 → 10/25~10/31 은 새로 시작한 후지
        KindRows fuji = concat(kind(d(1, 2), d(8, 10), 27000, "경동"), kind(d(10, 25), d(12, 31), 30000, "경동"));
        KindRows hongro = kind(d(8, 20), d(10, 31), 24000, "경동");

        KindRows merged = KamisRetailService.mergeKinds(List.of(fuji, hongro));

        assertEquals(24000, average(merged, d(10, 24)));
        assertEquals(30000, average(merged, d(10, 25)));
        assertEquals(30000, average(merged, d(10, 31)));
    }

    @Test
    void 시작이_같으면_더_오래_이어지는_품종() {
        KindRows autumn = kind(d(1, 2), d(1, 10), 4000, "경동");   // 해를 넘어온 가을 배추가 곧 끝난다
        KindRows winter = kind(d(1, 2), d(3, 31), 5000, "경동");

        KindRows merged = KamisRetailService.mergeKinds(List.of(autumn, winter));

        assertEquals(5000, average(merged, d(1, 5)));
    }

    @Test
    void 판매처마다_따로_고른다() {
        // 겹치는 날 새 품종이 복조리에만 있으면 경동은 원래 품종 값을 둔다
        KindRows old = kind(d(6, 1), d(6, 30), 2500, "경동", "복조리");
        KindRows fresh = kind(d(6, 20), d(7, 31), 1800, "복조리");

        KindRows merged = KamisRetailService.mergeKinds(List.of(old, fresh));

        assertEquals(2500, market(merged, d(6, 25), "경동"));
        assertEquals(1800, market(merged, d(6, 25), "복조리"));
    }

    @Test
    void 품종이_하나면_그대로() {
        KindRows only = kind(d(3, 1), d(3, 3), 1000, "경동");
        assertSame(only, KamisRetailService.mergeKinds(List.of(only)));
    }

    @Test
    void 철은_조사일이_30일_넘게_끊기는_곳에서_나뉜다() {
        var dates = new java.util.TreeSet<>(List.of(d(1, 2), d(1, 31), d(3, 5), d(3, 6)));

        Map<LocalDate, LocalDate[]> seasons = KamisRetailService.seasonsOf(dates);

        assertArrayEquals(new LocalDate[]{d(1, 2), d(1, 31)}, seasons.get(d(1, 31)));   // 29일 간격은 이어진다
        assertArrayEquals(new LocalDate[]{d(3, 5), d(3, 6)}, seasons.get(d(3, 5)));     // 33일 간격은 끊긴다
    }
}
