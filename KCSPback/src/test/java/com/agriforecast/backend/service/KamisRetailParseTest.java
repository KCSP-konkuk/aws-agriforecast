package com.agriforecast.backend.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** KAMIS 소매 기간 응답 파싱. 응답 모양은 2026-09-28 양배추 서울 실제 응답에서 떼어 왔다. 외부 의존 없음 */
class KamisRetailParseTest {

    private static String row(String county, String market, String kind, String regday, String price) {
        String item = kind == null ? "null" : "\"양배추\"";
        return String.format(
                "{\"itemname\":%s,\"kindname\":%s,\"countyname\":\"%s\",\"marketname\":%s,\"yyyy\":\"2026\",\"regday\":\"%s\",\"price\":\"%s\"}",
                item, kind == null ? "null" : "\"" + kind + "\"", county,
                market == null ? "null" : "\"" + market + "\"", regday, price);
    }

    private static final String BODY = "{\"condition\":{\"item\":{\"p_startday\":\"2026-01-01\"}},"
            + "\"data\":{\"error_code\":\"000\",\"item\":["
            + String.join(",",
                row("평균", null, null, "09/19", "2,790"),
                row("평균", null, null, "09/22", "2,841"),
                row("평균", null, null, "09/23", "2,841"),
                row("평년", null, null, "09/22", "4,771"),
                row("서울", "경동", "양배추(1포기)", "09/22", "4,000"),
                row("서울", "A-유통", "양배추(1포기)", "09/22", "-"),
                row("서울", "B-유통", "양배추(1포기)", "09/22", "2,080"),
                row("서울", "경동", "양배추(1포기)", "09/23", "4,000"))
            + "]}}";

    @Test
    void 평균_행을_날짜별_서울_소매가로_읽는다() throws Exception {
        List<KamisRetailService.DailyRetail> rows =
                KamisRetailService.parse(BODY, LocalDate.of(2026, 9, 22), LocalDate.of(2026, 9, 23));

        assertEquals(2, rows.size());
        assertEquals(LocalDate.of(2026, 9, 22), rows.get(0).date());
        assertEquals(2841, rows.get(0).price());
        assertEquals("1포기", rows.get(0).unit());
        assertEquals(2, rows.get(0).marketCount());   // "-" 인 A-유통은 세지 않는다
        assertEquals(1, rows.get(1).marketCount());
    }

    @Test
    void 요청_구간_밖의_날짜와_평년_행은_버린다() throws Exception {
        List<KamisRetailService.DailyRetail> rows =
                KamisRetailService.parse(BODY, LocalDate.of(2026, 9, 23), LocalDate.of(2026, 9, 23));

        assertEquals(1, rows.size());
        assertEquals(LocalDate.of(2026, 9, 23), rows.get(0).date());
    }

    @Test
    void 데이터가_없으면_빈_목록() throws Exception {
        String noData = "{\"condition\":[{\"p_startday\":\"2026-09-21\"}],\"data\":[\"001\"]}";
        assertTrue(KamisRetailService.parse(noData, LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 23)).isEmpty());
    }

    @Test
    void 단위는_품종명_마지막_괄호에서_뽑는다() {
        assertEquals("1kg", KamisRetailService.unitOf("양파(1kg)"));
        assertEquals("1포기", KamisRetailService.unitOf("여름(고랭지)(1포기)"));
        assertEquals("100g", KamisRetailService.unitOf("붉은고추(100g)"));
    }

    @Test
    void 연도를_넘는_구간은_연도별로_자르고_조회는_1월1일부터() {
        List<LocalDate[]> chunks = KamisRetailService.yearChunks(LocalDate.of(2025, 12, 20), LocalDate.of(2026, 1, 5));
        assertEquals(2, chunks.size());
        assertEquals(LocalDate.of(2025, 12, 31), chunks.get(0)[1]);
        assertEquals(LocalDate.of(2026, 1, 1), chunks.get(1)[0]);

        LocalDate today = LocalDate.of(2026, 9, 28);
        assertArrayEquals(new LocalDate[]{LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31)},
                KamisRetailService.yearQuery(2025, today));
        assertArrayEquals(new LocalDate[]{LocalDate.of(2026, 1, 1), today},
                KamisRetailService.yearQuery(2026, today));
    }
}
