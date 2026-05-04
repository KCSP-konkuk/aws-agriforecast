package com.agriforecast.backend;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 농넷 가락시장(garak.do) 데이터 직접 크롤링 테스트 (일자별 연속 수집)
 */
public class NongnetCrawlerTest {

    public static void main(String[] args) {
        String url = "https://www.nongnet.or.kr/front/M000000258/marketInfo/garak.do";

        System.out.println("========== 농넷(Nongnet) 일자별 연속 정밀 크롤링 시작 ==========");

        // {품목명, 품목코드, 단위명, 단위코드}
        Map<String, String[]> targetItems = new LinkedHashMap<>();
        targetItems.put("배추", new String[] { "21100", "10키로망대", "10" });
        targetItems.put("양파", new String[] { "24400", "1키로", "1" });
        targetItems.put("양배추", new String[] { "21200", "8키로망대", "8" });
        targetItems.put("당근", new String[] { "23200", "20키로상자", "20" });

        // ================== [수집 기간 설정] ==================
        // 시작일과 종료일을 세팅합니다! (1년치 데이터 수집)
        LocalDate startDate = LocalDate.of(2026, 3, 22);
        LocalDate endDate = LocalDate.of(2026, 3, 28);

        // 날짜를 "0000년 00월 00일" 형태 문자열로 돌려주는 포맷터
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");

        // 시작일부터 종료일까지 하루씩 더해가며 반복합니다.
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            String targetDateStr = date.format(formatter);
            System.out.println("\n#####################################################");
            System.out.println(" 📅 기준 날짜 이동: [" + targetDateStr + "] 데이터 수집");
            System.out.println("#####################################################");

            for (Map.Entry<String, String[]> item : targetItems.entrySet()) {
                String pumName = item.getKey();
                String pumCd = item.getValue()[0];
                String trdName = item.getValue()[1];
                String trdCd = item.getValue()[2];

                System.out.println("\n[" + pumName + " / " + trdName + " 데이터 추출 중...]");

                try {
                    Document doc = Jsoup.connect(url)
                            .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                            .data("searchSymbol1", "garak")
                            .data("searchName1", "가락")
                            .data("menuType", "garak")
                            .data("searchDate", targetDateStr) // 날짜 파라미터가 자동으로 변함!
                            .data("bestDate", targetDateStr) // 동시 변경
                            .data("searchName2", pumName)
                            .data("searchSymbol2", pumCd)
                            .data("searchScd", pumCd)
                            .data("searchName3", trdName)
                            .data("searchSymbol3", trdCd)
                            .data("searchTrd", trdCd)
                            .timeout(10000)
                            .post(); // POST 전송

                    Elements tables = doc.select("table");
                    if (!tables.isEmpty()) {
                        Element firstTable = tables.first();
                        Elements rows = firstTable.select("tr");

                        // 결과 중 가장 최상단(선택 날짜)의 등급별 가격만 간략히 출력
                        if (rows.size() > 1) {
                            Elements ths = rows.get(0).select("th"); // 헤더 (날짜, 특, 상, 보통...)
                            Element targetRow = rows.get(1); // 핵심 데이터 첫 번째 줄
                            String realDate = targetRow.select("th").text(); // 서버가 진짜로 뱉어준 그 날짜!
                            Elements tds = targetRow.select("td");

                            System.out.println("👉 진짜 응답 날짜: [" + realDate + "]");
                            System.out.print("👉 가격 내역: ");

                            // i=1 (특)부터 시작해서 한 칸씩 맞춰줌
                            for (int i = 1; i < ths.size() && (i - 1) < tds.size(); i++) {
                                System.out.print(ths.get(i).text() + "(" + tds.get(i - 1).text() + ") ");
                            }
                            System.out.println();
                        }
                    } else {
                        System.out.println("테이블을 찾을 수 없거나 데이터가 없습니다.");
                    }

                } catch (Exception e) {
                    System.err.println("에러 발생: " + e.getMessage());
                }
                // 농넷 서버 과부하 및 봇 차단(IP Block) 방지를 위해 1건 조회 후 1초간 휴식!
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignore) {
                }
            }
        }
        System.out.println("\n========== 농넷(Nongnet) 일자별 크롤링 완전 종료 ==========");
    }
}
