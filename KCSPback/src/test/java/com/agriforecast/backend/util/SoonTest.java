package com.agriforecast.backend.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** 순(상·중·하) 계산. 외부 의존 없음 */
class SoonTest {

    @Test
    void 날짜로_순을_정한다() {
        assertEquals("202609상순", Soon.of(LocalDate.of(2026, 9, 10)).code());
        assertEquals("202609중순", Soon.of(LocalDate.of(2026, 9, 11)).code());
        assertEquals("202609중순", Soon.of(LocalDate.of(2026, 9, 20)).code());
        assertEquals("202609하순", Soon.of(LocalDate.of(2026, 9, 21)).code());
        assertEquals("202602하순", Soon.of(LocalDate.of(2026, 2, 28)).code());
    }

    @Test
    void 시작일과_끝일() {
        Soon s = Soon.of(LocalDate.of(2026, 9, 25));
        assertEquals(LocalDate.of(2026, 9, 21), s.start());
        assertEquals(LocalDate.of(2026, 9, 30), s.end());
        assertEquals(LocalDate.of(2026, 2, 28), Soon.of(LocalDate.of(2026, 2, 22)).end());
        assertEquals(LocalDate.of(2026, 10, 10), Soon.of(LocalDate.of(2026, 10, 1)).end());
    }

    @Test
    void 다음_이전_순은_월과_연도를_넘는다() {
        assertEquals("202610상순", Soon.of(LocalDate.of(2026, 9, 30)).next().code());
        assertEquals("202701상순", Soon.of(LocalDate.of(2026, 12, 25)).next().code());
        assertEquals("202512하순", Soon.of(LocalDate.of(2026, 1, 3)).previous().code());
        assertEquals("202609상순", Soon.of(LocalDate.of(2026, 9, 15)).previous().code());
    }

    @Test
    void 코드_파싱과_라벨() {
        Soon s = Soon.parse("202610상순");
        assertEquals(LocalDate.of(2026, 10, 1), s.start());
        assertEquals("10월 상순", s.label());
        assertThrows(IllegalArgumentException.class, () -> Soon.parse("2026-10"));
        assertTrue(s.contains(LocalDate.of(2026, 10, 10)));
        assertFalse(s.contains(LocalDate.of(2026, 10, 11)));
    }
}
