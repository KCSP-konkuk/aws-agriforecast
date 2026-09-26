package com.agriforecast.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 홈 화면 KAMIS 소매가 품목 선택. 품목명·번호는 2026-09-23 실제 응답 기준. 외부 의존 없음 */
class KamisServiceTargetTest {

    @Test
    void 배추는_계절별_품목번호와_상관없이_고른다() {
        assertTrue(KamisService.isTarget("01", "291", "배추/여름(고랭지)"));
        assertTrue(KamisService.isTarget("01", "295", "배추/가을"));
    }

    @Test
    void 이름에_배추가_들어간_다른_품목은_고르지_않는다() {
        assertFalse(KamisService.isTarget("01", "2241", "알배기배추/알배기배추"));
        assertFalse(KamisService.isTarget("01", "305", "얼갈이배추/얼갈이배추"));
        assertTrue(KamisService.isTarget("01", "297", "양배추/양배추"));  // 양배추는 번호로 원래 대상
    }

    @Test
    void 도매가격이나_대상이_아닌_품목은_고르지_않는다() {
        assertFalse(KamisService.isTarget("02", "30", "배추/여름(고랭지)"));
        assertFalse(KamisService.isTarget("01", "361", "양파/양파"));
    }
}
