package com.agriforecast.backend.service;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.junit.jupiter.api.Test;

import java.util.Map;

/**
 * 농넷 크롤링 동작 확인용 독립 테스트 (Spring 컨텍스트 불필요)
 * - 세션 쿠키 획득 여부
 * - POST 응답 테이블 파싱 여부
 * - 가격 추출 성공 여부
 */
public class NongnetCrawlTest {

    private static final String URL = "https://www.nongnet.or.kr/front/M000000258/marketInfo/garak.do";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    @Test
    void testCrawl() throws Exception {
        // ── Step 1: GET으로 세션 쿠키 획득 ──────────────────────────
        System.out.println("=== [Step 1] GET 요청으로 세션 쿠키 획득 ===");
        Connection.Response sessionResponse = Jsoup.connect(URL)
                .userAgent(USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "ko-KR,ko;q=0.9")
                .method(Connection.Method.GET)
                .timeout(10000)
                .execute();

        Map<String, String> cookies = sessionResponse.cookies();
        System.out.println("  획득된 쿠키: " + cookies);

        // ── Step 2: POST로 실제 데이터 요청 ─────────────────────────
        // 테스트 대상: 양파, 2025년 3월 15일
        String testDate = "2025년 03월 15일";
        String pumName  = "양파";
        String pumCd    = "24400";
        String trdName  = "1키로";
        String trdCd    = "1";

        System.out.println("\n=== [Step 2] POST 요청 (" + testDate + " / " + pumName + ") ===");
        Document doc = Jsoup.connect(URL)
                .userAgent(USER_AGENT)
                .cookies(cookies)
                .referrer(URL)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "ko-KR,ko;q=0.9")
                .data("searchSymbol1", "garak")
                .data("searchName1", "가락")
                .data("menuType", "garak")
                .data("searchDate", testDate)
                .data("bestDate", testDate)
                .data("searchName2", pumName)
                .data("searchSymbol2", pumCd)
                .data("searchScd", pumCd)
                .data("searchName3", trdName)
                .data("searchSymbol3", trdCd)
                .data("searchTrd", trdCd)
                .timeout(10000)
                .post();

        // ── Step 3: 응답 파싱 ────────────────────────────────────────
        System.out.println("\n=== [Step 3] 응답 파싱 ===");
        String bodyText = doc.body().text();
        if (bodyText.contains("서비스 접속이 원활하지 않습니다") || bodyText.contains("접근이 차단")) {
            System.out.println("  [실패] 서버에서 접근 차단됨: " + bodyText.substring(0, Math.min(200, bodyText.length())));
            return;
        }

        Elements tables = doc.select("table");
        if (tables.isEmpty()) {
            System.out.println("  [실패] 테이블 없음. 응답 본문 앞 500자:");
            System.out.println(bodyText.substring(0, Math.min(500, bodyText.length())));
            return;
        }

        Element firstTable = tables.first();
        Elements rows = firstTable.select("tr");
        System.out.println("  테이블 행 수: " + rows.size());

        if (rows.size() > 1) {
            Elements ths = rows.get(0).select("th");
            Element dataRow = rows.get(1);
            String realDate = dataRow.select("th").text();
            Elements tds = dataRow.select("td");

            System.out.println("  서버 응답 날짜: " + realDate);
            System.out.print("  등급별 가격: ");
            for (int i = 1; i < ths.size() && (i - 1) < tds.size(); i++) {
                System.out.print(ths.get(i).text() + "=" + tds.get(i - 1).text() + "  ");
            }
            System.out.println();
            System.out.println("\n  [성공] 크롤링 정상 동작");
        } else {
            System.out.println("  [실패] 데이터 행 없음");
        }
    }
}