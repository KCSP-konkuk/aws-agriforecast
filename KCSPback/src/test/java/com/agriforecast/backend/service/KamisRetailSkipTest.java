package com.agriforecast.backend.service;

import com.agriforecast.backend.repository.RetailMarketPriceRepository;
import com.agriforecast.backend.repository.RetailPriceRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 초기 적재가 판매처별 값이 있는 지난 해를 다시 요청하지 않는지. 외부 요청 없음 */
class KamisRetailSkipTest {

    @Test
    void 판매처별_값이_있는_지난_해는_건너뛴다() {
        RetailPriceRepository prices = mock(RetailPriceRepository.class);
        RetailMarketPriceRepository markets = mock(RetailMarketPriceRepository.class);
        when(markets.existsByItemNameAndPriceDateBetween(eq("양파"), any(), any())).thenReturn(true);
        KamisRetailService service = new KamisRetailService(prices, markets);

        int changed = service.collectItem("양파", LocalDate.of(2014, 1, 1), LocalDate.of(2015, 12, 31), true);

        assertEquals(0, changed);
        verify(markets, times(2)).existsByItemNameAndPriceDateBetween(eq("양파"), any(), any());
        verify(markets, never()).findByItemNameAndPriceDateBetween(any(), any(), any());
        verifyNoInteractions(prices);
    }
}
