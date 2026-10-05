package com.agriforecast.backend.service;

import com.agriforecast.backend.repository.WholesaleMarketPriceRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * KAMIS 도매(16번) 수집. 응답 모양은 소매와 같다('평균'·'평년' + 시장별 행, 서울 시장 = 가락도매 —
 * model-research data/retail/wholesale_seoul_2014.csv 가 이 모양에서 나왔다). 외부 요청 없음
 */
class KamisWholesaleServiceTest {

    private static final String BODY = "{\"condition\":{\"item\":{\"p_startday\":\"2026-01-01\"}},"
            + "\"data\":{\"error_code\":\"000\",\"item\":["
            + "{\"itemname\":null,\"kindname\":null,\"countyname\":\"평균\",\"marketname\":null,\"yyyy\":\"2026\",\"regday\":\"09/29\",\"price\":\"15,500\"},"
            + "{\"itemname\":null,\"kindname\":null,\"countyname\":\"평년\",\"marketname\":null,\"yyyy\":\"2026\",\"regday\":\"09/29\",\"price\":\"21,140\"},"
            + "{\"itemname\":\"애호박\",\"kindname\":\"애호박(20개)\",\"countyname\":\"서울\",\"marketname\":\"가락도매\",\"yyyy\":\"2026\",\"regday\":\"09/28\",\"price\":\"16,700\"},"
            + "{\"itemname\":\"애호박\",\"kindname\":\"애호박(20개)\",\"countyname\":\"서울\",\"marketname\":\"가락도매\",\"yyyy\":\"2026\",\"regday\":\"09/29\",\"price\":\"15,500\"}"
            + "]}}";

    @Test
    void 가락도매_행만_시장별_값으로_읽는다() throws Exception {
        List<KamisRetailService.MarketRetail> rows =
                KamisRetailService.parseMarkets(BODY, LocalDate.of(2026, 9, 28), LocalDate.of(2026, 9, 29));

        assertEquals(List.of(
                new KamisRetailService.MarketRetail(LocalDate.of(2026, 9, 28), "가락도매", 16700),
                new KamisRetailService.MarketRetail(LocalDate.of(2026, 9, 29), "가락도매", 15500)), rows);
    }

    @Test
    void 값이_있는_지난_해는_건너뛴다() {
        WholesaleMarketPriceRepository repo = mock(WholesaleMarketPriceRepository.class);
        when(repo.existsByItemNameAndPriceDateBetween(eq("시금치"), any(), any())).thenReturn(true);
        KamisWholesaleService service = new KamisWholesaleService(repo);

        int changed = service.collectItem("시금치", LocalDate.of(2014, 1, 1), LocalDate.of(2015, 12, 31), true);

        assertEquals(0, changed);
        verify(repo, times(2)).existsByItemNameAndPriceDateBetween(eq("시금치"), any(), any());
        verify(repo, never()).findByItemNameAndPriceDateBetween(any(), any(), any());
    }

    @Test
    void 도매_품목은_소매와_같고_품목_코드도_같다() {
        assertEquals(List.copyOf(KamisRetailService.TARGET_ITEMS.keySet()), List.copyOf(KamisWholesaleService.TARGET_ITEMS.keySet()));
        KamisWholesaleService.TARGET_ITEMS.forEach((item, codes) -> {
            KamisItems.Codes retail = KamisRetailService.TARGET_ITEMS.get(item);
            assertEquals(retail.category(), codes.category(), item);
            assertEquals(retail.item(), codes.item(), item);
            assertFalse(codes.kinds().isEmpty(), item);
        });
    }

    @Test
    void 거래_단위는_날짜별로_평균_행에서() throws Exception {
        String body = BODY.replace("애호박(20개)", "여름(고랭지)(10kg(그물망 3포기))");
        List<KamisRetailService.DailyRetail> averages =
                KamisRetailService.parse(body, LocalDate.of(2026, 9, 28), LocalDate.of(2026, 9, 29));

        assertEquals(Map.of(LocalDate.of(2026, 9, 29), "10kg(그물망 3포기)"), KamisWholesaleService.units(averages));
    }
}
