package com.agriforecast.backend.service;

import com.agriforecast.backend.repository.GarakSupplySoonRepository;
import com.agriforecast.backend.util.Soon;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 농넷 가락 순별 반입량 — 응답 읽기 · 구간 나누기 · 코드 더하기 · 지난 구간 건너뛰기. 외부 요청 없음 */
class GarakSupplyServiceTest {

    /** 2026-10-06 무(23100) 실제 응답에서 떼어 온 모양 (필드 일부) */
    private static final String BODY = "{\"datalist\":["
            + "{\"year\":2014,\"month\":1,\"soonVal\":2,\"soonName\":\"중순\",\"rank1Weight\":0,\"rank2Weight\":0,"
            + "\"rank1Name\":null,\"rank2Name\":null,\"etc\":0,\"selectSoon\":0,\"bfSoon\":709},"
            + "{\"year\":2014,\"month\":1,\"soonVal\":1,\"soonName\":\"상순\",\"rank1Weight\":352,\"rank2Weight\":120,"
            + "\"rank1Name\":\"전라북도 고창군\",\"rank2Name\":\"제주도 제주시\",\"etc\":237,\"selectSoon\":709,\"bfSoon\":1595}"
            + "]}";

    @Test
    void 응답을_순_첫날별로_읽고_0은_기록_없음() throws Exception {
        List<GarakSupplyService.SoonVolume> rows = GarakSupplyService.parse(BODY);

        assertEquals(List.of(
                new GarakSupplyService.SoonVolume(LocalDate.of(2014, 1, 11), null, null, null, null, null),
                new GarakSupplyService.SoonVolume(LocalDate.of(2014, 1, 1), 709.0, "전라북도 고창군", 352.0, "제주도 제주시", 120.0)),
                rows);
    }

    @Test
    void 구간은_오늘이_든_순부터_9순씩_거슬러_시작일이_든_순이_들어갈_때까지() {
        // 202610상순 구간 = 202607중순 ~ 202610상순, 202607상순 구간 = 202604중순 ~ 202607상순
        assertEquals(Soon.parse("202607중순"), GarakSupplyService.back(Soon.parse("202610상순"), 8));
        assertEquals(List.of(Soon.parse("202610상순"), Soon.parse("202607상순")),
                GarakSupplyService.windowEnds(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 10, 6)));
        assertEquals(List.of(Soon.parse("202610상순"), Soon.parse("202607상순"), Soon.parse("202604상순")),
                GarakSupplyService.windowEnds(LocalDate.of(2026, 4, 5), LocalDate.of(2026, 10, 6)));
        assertEquals(List.of(Soon.parse("202610상순")),
                GarakSupplyService.windowEnds(LocalDate.of(2026, 10, 6), LocalDate.of(2026, 10, 6)));
    }

    @Test
    void 여러_코드는_순마다_값이_있는_것만_더하고_산지는_비운다() {
        LocalDate d1 = LocalDate.of(2025, 6, 1), d2 = LocalDate.of(2025, 6, 11);
        List<GarakSupplyService.SoonVolume> red = List.of(
                new GarakSupplyService.SoonVolume(d1, 481.0, "강원도 철원군", 200.0, null, null),
                new GarakSupplyService.SoonVolume(d2, null, null, null, null, null));
        List<GarakSupplyService.SoonVolume> yellow = List.of(
                new GarakSupplyService.SoonVolume(d1, 307.0, "강원도 철원군", 150.0, null, null),
                new GarakSupplyService.SoonVolume(d2, null, null, null, null, null));

        List<GarakSupplyService.SoonVolume> sum = GarakSupplyService.combine(List.of(red, yellow));

        assertEquals(List.of(new GarakSupplyService.SoonVolume(d1, 788.0, null, null, null, null),
                new GarakSupplyService.SoonVolume(d2, null, null, null, null, null)), sum);
        assertSame(red, GarakSupplyService.combine(List.of(red)));
    }

    @Test
    void 아홉_순이_다_있는_지난_구간은_건너뛴다() {
        GarakSupplySoonRepository repo = mock(GarakSupplySoonRepository.class);
        when(repo.countByItemNameAndSoonStartBetween(eq("무"), any(), any())).thenReturn(9L);
        GarakSupplyService service = new GarakSupplyService(repo);

        int changed = service.collectItem("무", LocalDate.of(2014, 1, 1), LocalDate.of(2014, 12, 31), true, Map.of());

        assertEquals(0, changed);
        verify(repo, never()).findByItemNameAndSoonStartBetween(any(), any(), any());
    }

    @Test
    void 품목은_작업대_KAMIS_품목이고_코드가_있다() {
        GarakSupplyService.ITEMS.forEach((item, garak) -> {
            assertTrue(KamisItems.RETAIL.containsKey(item), item);
            assertFalse(garak.codes().isEmpty(), item);
            garak.codes().forEach(code -> assertTrue(code.matches("\\d{5}"), item + " " + code));
        });
        // 서울시농수산식품공사 일별 반입량(SupplyCollectService)이 있는 품목은 여기서 받지 않는다
        assertFalse(GarakSupplyService.ITEMS.containsKey("배추"));
        assertFalse(GarakSupplyService.ITEMS.containsKey("양파"));
    }
}
