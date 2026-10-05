package com.agriforecast.backend.service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * KAMIS 서울 소매가 · 도매가 수집 품목 (KamisRetailService · KamisWholesaleService)
 *
 * 고른 기준 (2026-10-05): 농업관측센터(KREI)가 수급을 관측하는 원예 · 식량 품목 가운데
 * KAMIS 가 서울 전통시장(경동 · 복조리) 소매가와 서울 도매가를 사철 조사하는 것.
 * 붉은고추 · 시금치는 관측 품목이 아니지만 소매 예측 품목이라 둔다.
 * 빠진 관측 품목: 수박 · 참외 · 딸기 · 복숭아 · 단감(철에만 조사), 감귤 · 포도(서울 상품 등급 조사 없음)
 *
 * 한 품목은 한 단위만 쓴다. 철마다 품종이 바뀌는 품목(배추 · 무 · 사과 · 배)은 단위가 같은 품종들을 받아
 * 한 줄로 잇는다(KamisRetailService.mergeKinds). 품종 코드는 KAMIS 부류별 일일가격(dailyPriceByCategoryList)에서,
 * 해마다 조사일 수는 기간 조회로 2014~2026 을 확인했다. 같은 때 나란히 조사되는 품종은 섞지 않고 하나만 쓴다
 * (감자 노지 · 시설, 건고추 화건 · 양건 — 값 수준이 달라 섞으면 이음매에서 튄다).
 * 서울 소매가 빈 때: 건고추 화건 2021-07~2023-06(그 사이 양건만 조사), 풋고추 2020~2022 한 판매처만
 */
final class KamisItems {

    private KamisItems() {
    }

    /** 부류코드 · 품목코드 · 품종코드들 (KAMIS 품목 · 등급 코드표) */
    record Codes(String category, String item, List<String> kinds) {
        Codes(String category, String item, String... kinds) {
            this(category, item, List.of(kinds));
        }
    }

    /** 소매 — 품목 이름 → 코드. 순서 = 수집 순서 */
    static final Map<String, Codes> RETAIL = createRetail();

    /** 도매 — 소매와 같은 품목 · 코드. 서울 도매 조사가 다른 품종으로만 있는 품목은 그 품종으로 바꾼다 */
    static final Map<String, Codes> WHOLESALE = createWholesale();

    private static Map<String, Codes> createRetail() {
        Map<String, Codes> items = new LinkedHashMap<>();
        // 엽근채소
        items.put("배추", new Codes("200", "211", "01", "02", "03", "06"));   // 봄 · 여름(고랭지) · 가을 · 월동 (1포기)
        items.put("무", new Codes("200", "231", "01", "02", "03", "06"));     // 봄 · 고랭지 · 가을 · 월동 (1개)
        items.put("당근", new Codes("200", "232", "01"));                     // 무세척(국산) (1kg)
        items.put("양배추", new Codes("200", "212", "00"));                   // 1포기
        // 양념채소
        items.put("건고추", new Codes("200", "241", "00"));                   // 화건 (600g)
        items.put("깐마늘", new Codes("200", "258", "01"));                   // 깐마늘(국산) (1kg)
        items.put("양파", new Codes("200", "245", "00"));                     // 1kg
        items.put("대파", new Codes("200", "246", "00"));                     // 1kg
        items.put("붉은고추", new Codes("200", "243", "00"));                 // 100g
        // 과채
        items.put("오이", new Codes("200", "223", "02"));                     // 다다기계통 (10개)
        items.put("애호박", new Codes("200", "224", "01"));                   // 1개
        items.put("토마토", new Codes("200", "225", "00"));                   // 1kg
        items.put("풋고추", new Codes("200", "242", "00"));                   // 풋고추(녹광 등) (100g)
        items.put("파프리카", new Codes("200", "256", "00"));                 // 1개
        items.put("시금치", new Codes("200", "213", "00"));                   // 100g
        // 과일
        items.put("사과", new Codes("400", "411", "05", "06", "07"));        // 후지 · 쓰가루(아오리) · 홍로 (10개)
        items.put("배", new Codes("400", "412", "01", "04"));                // 신고 · 원황 (10개)
        // 식량
        items.put("쌀", new Codes("100", "111", "01"));                      // 20kg
        items.put("감자", new Codes("100", "152", "01"));                    // 수미(노지) (100g)
        items.put("콩", new Codes("100", "141", "01"));                      // 흰 콩(국산) (500g)
        return Collections.unmodifiableMap(items);
    }

    private static Map<String, Codes> createWholesale() {
        Map<String, Codes> items = new LinkedHashMap<>(RETAIL);
        // 서울 도매 깐마늘(20kg)은 2018-01 에 '깐마늘(국산)' 이 대서 · 남도로 나뉘었다 → 그 전은 국산, 그 뒤는 많이 나는 대서
        items.put("깐마늘", new Codes("200", "258", "01", "03"));
        return Collections.unmodifiableMap(items);
    }
}
