package com.agriforecast.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** 적중 이력 요약 계산. 외부 의존 없음 */
class PredictionHistoryTest {

    private static Map<String, Object> row(double pred, double actual) {
        return Map.of("predictedPrice", pred, "actualPrice", actual);
    }

    @Test
    void 평균_절대_오차율을_계산한다() {
        // |110-100|/100 = 10%, |90-100|/100 = 10%, |130-100|/100 = 30% → 평균 16.67
        assertEquals(16.67, PredictionService.mape(List.of(row(110, 100), row(90, 100), row(130, 100))));
    }

    @Test
    void 실제가가_0이거나_행이_없으면_제외한다() {
        assertEquals(10.0, PredictionService.mape(List.of(row(110, 100), row(5, 0))));
        assertNull(PredictionService.mape(List.of()));
    }
}
