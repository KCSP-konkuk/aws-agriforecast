package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.RetailPrice;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 홈 서울 소매가 섹션의 순 계산·요약. 외부 의존 없음 */
class RetailPriceServiceTest {

    private static RetailPrice rp(String date, int price) {
        RetailPrice r = new RetailPrice();
        r.setItemName("양파");
        r.setPriceDate(LocalDate.parse(date));
        r.setPrice(price);
        r.setUnit("1kg");
        return r;
    }

    @Test
    void 순_판정_경계() {
        assertEquals("2026-09 상순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 10)));
        assertEquals("2026-09 중순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 11)));
        assertEquals("2026-09 중순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 20)));
        assertEquals("2026-09 하순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 21)));
        assertEquals("2026-08 하순", RetailPriceService.soonLabel(LocalDate.of(2026, 8, 31)));
        assertEquals(LocalDate.of(2026, 9, 21), RetailPriceService.soonStart(LocalDate.of(2026, 9, 30)));
    }

    @Test
    void 직전_순은_월_경계를_넘는다() {
        assertEquals(LocalDate.of(2026, 9, 21), RetailPriceService.previousSoonStart(LocalDate.of(2026, 10, 1)));
        assertEquals(LocalDate.of(2026, 10, 1), RetailPriceService.previousSoonStart(LocalDate.of(2026, 10, 15)));
        assertEquals(LocalDate.of(2025, 12, 21), RetailPriceService.previousSoonStart(LocalDate.of(2026, 1, 3)));
    }

    @Test
    void 순_평균은_조사일_단순평균_반올림() {
        List<RetailPriceService.Point> soons = RetailPriceService.soonAverages(List.of(
                rp("2026-09-01", 1000), rp("2026-09-02", 1001), rp("2026-09-11", 1200)));
        assertEquals(2, soons.size());
        assertEquals(new RetailPriceService.Point(LocalDate.of(2026, 9, 1), "2026-09 상순", 1001, 2), soons.get(0));
        assertEquals(new RetailPriceService.Point(LocalDate.of(2026, 9, 11), "2026-09 중순", 1200, 1), soons.get(1));
    }

    @Test
    void 요약은_직전_순_평균과_비교한다() {
        RetailPriceService.Summary s = RetailPriceService.summarize("양파", "1kg", List.of(
                rp("2026-09-11", 2000), rp("2026-09-15", 2000), rp("2026-09-23", 1840)));
        assertEquals(LocalDate.of(2026, 9, 23), s.latestDate());
        assertEquals(1840, s.latestPrice());
        assertEquals(2000, s.prevSoonAvg());
        assertEquals(-8.0, s.changePct());   // (1840-2000)/2000 = -8.0%
        assertNull(s.prediction());
    }

    @Test
    void 직전_순에_조사일이_없으면_증감은_null() {
        RetailPriceService.Summary s = RetailPriceService.summarize("양파", "1kg", List.of(
                rp("2026-09-02", 2000), rp("2026-09-23", 1841)));   // 중순이 비었다
        assertNull(s.prevSoonAvg());
        assertNull(s.changePct());
    }

    @Test
    void 데이터가_없는_품목도_자리를_남긴다() {
        RetailPriceService.Summary s = RetailPriceService.summarize("양배추", "1포기", List.of());
        assertEquals("양배추", s.itemName());
        assertEquals("1포기", s.unit());
        assertNull(s.latestDate());
        assertNull(s.latestPrice());
        assertNull(s.changePct());
    }

    @Test
    void 홈_차트는_2년_전_달_1일부터() {
        assertEquals(LocalDate.of(2024, 9, 1), RetailPriceService.chartFrom(LocalDate.of(2026, 9, 29)));
        assertEquals(LocalDate.of(2024, 2, 1), RetailPriceService.chartFrom(LocalDate.of(2026, 2, 28)));
    }
}
