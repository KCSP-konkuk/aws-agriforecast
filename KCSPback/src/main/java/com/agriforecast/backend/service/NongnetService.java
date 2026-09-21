package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.AgriPrice;
import com.agriforecast.backend.repository.AgriPriceRepository;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 농넷(Nongnet) 가락시장 데이터 직접 크롤링 서비스 (일별 데이터 수집)
 * 기존 KAMIS API를 대체하여 Jsoup 기반 크롤링 수행.
 */
@Service
public class NongnetService {

    private static final Logger logger = LoggerFactory.getLogger(NongnetService.class);
    private static final String URL = "https://www.nongnet.or.kr/front/M000000258/marketInfo/garak.do";
    private static final Map<String, String[]> TARGET_ITEMS = createTargetItems();
    /** 농넷은 간헐적으로 응답이 늘어진다. 실패 건만 아래 횟수까지 다시 시도한다. */
    private static final int MAX_ATTEMPTS = 3;
    private static final int TIMEOUT_MS = 20000;
    private static final long RETRY_DELAY_MS = 3000L;

    private final AgriPriceRepository agriPriceRepository;

    public NongnetService(AgriPriceRepository agriPriceRepository) {
        this.agriPriceRepository = agriPriceRepository;
    }

    /**
     * 특정 연월의 데이터 크롤링 및 수집 (매일 하루씩)
     */
    public int collectPriceByYearMonth(int year, int month) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = ym.atEndOfMonth();
        return collectPriceByDateRange(startDate, endDate);
    }

    /**
     * 반입량 크롤링. 현재는 API를 사용하지 않고 비워둠.
     */
    public int collectSupplyByYearMonth(int year, int month) {
        logger.info("반입량 수집은 현재 미구현(농넷 크롤링 대체 필요)");
        return 0;
    }

    /**
     * 시작일부터 종료일까지 매일(일별) 크롤링 수행
     */
    public int collectPriceByDateRange(LocalDate startDate, LocalDate endDate) {
        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyy년 MM월 dd일");
        int savedCount = 0;

        // GET으로 세션 쿠키 획득 (POST 차단 방지)
        Map<String, String> sessionCookies = acquireSessionCookies();

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            String targetDateStr = date.format(dateFmt);
            int currentYear = date.getYear();
            int currentMonth = date.getMonthValue();
            int currentDay = date.getDayOfMonth();

            for (Map.Entry<String, String[]> item : TARGET_ITEMS.entrySet()) {
                String pumName = item.getKey();
                String pumCd = item.getValue()[0];
                String trdName = item.getValue()[1];
                String trdCd = item.getValue()[2];

                // 이미 해당 일자의 해당 작물 데이터가 존재하는지 확인
                if (agriPriceRepository.findByItemNameAndYearAndMonthAndDay(
                        pumName, currentYear, currentMonth, currentDay).isPresent()) {
                    continue; // Skip if already exists
                }

                try {
                    Document doc = fetchWithRetry(sessionCookies, targetDateStr, pumName, pumCd, trdName, trdCd);
                    if (doc == null) {
                        continue;
                    }
                    Elements tables = doc.select("table");
                    if (!tables.isEmpty()) {
                        Element firstTable = tables.first();
                        Elements rows = firstTable.select("tr");

                        if (rows.size() > 1) {
                            Elements ths = rows.get(0).select("th"); // 헤더 (특, 상, 보통...)
                            Element targetRow = rows.get(1); // 핵심 데이터
                            Elements tds = targetRow.select("td");

                            // "상" (High) 등급의 가격을 우선 추출 (없으면 "보통" 등)
                            Double priceToSave = null;
                            for (int i = 1; i < ths.size() && (i - 1) < tds.size(); i++) {
                                String gradeType = ths.get(i).text();
                                if ("상".equals(gradeType) || "평균".equals(gradeType) || "보통".equals(gradeType)) {
                                    String priceStr = tds.get(i - 1).text().replace(",", "").trim();
                                    if (!priceStr.isEmpty() && !priceStr.equals("-")) {
                                        priceToSave = Double.parseDouble(priceStr);
                                        if ("상".equals(gradeType)) {
                                            break; // '상'에 실제 값이 있을 때만 종료
                                        }
                                    }
                                }
                            }

                            if (priceToSave != null) {
                                AgriPrice entity = new AgriPrice();
                                entity.setItemName(pumName);
                                entity.setYear(currentYear);
                                entity.setMonth(currentMonth);
                                entity.setDay(currentDay);
                                entity.setAvgPrice(priceToSave);
                                agriPriceRepository.save(entity);
                                savedCount++;
                            }
                        }
                    }

                } catch (Exception e) {
                    logger.error("Nongnet 크롤링 에러 ({} - {}): {}", targetDateStr, pumName, e.getMessage());
                }

                // 봇 차단 방지용 딜레이
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ignore) {}
            }
        }
        logger.info("Nongnet 크롤링 {}건 DB 저장 완료 ({} ~ {})", savedCount, startDate, endDate);
        return savedCount;
    }


    /**
     * 농넷 일별 표를 가져온다. 타임아웃 등 실패 시 MAX_ATTEMPTS 까지 재시도하고,
     * 끝내 실패하면 null 을 돌려준다(해당 건만 건너뜀).
     */
    private Document fetchWithRetry(Map<String, String> sessionCookies, String targetDateStr,
                                    String pumName, String pumCd, String trdName, String trdCd) {
        Exception last = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return Jsoup.connect(URL)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        .cookies(sessionCookies)
                        .referrer(URL)
                        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                        .header("Accept-Language", "ko-KR,ko;q=0.9")
                        .data("searchSymbol1", "garak")
                        .data("searchName1", "가락")
                        .data("menuType", "garak")
                        .data("searchDate", targetDateStr)
                        .data("bestDate", targetDateStr)
                        .data("searchName2", pumName)
                        .data("searchSymbol2", pumCd)
                        .data("searchScd", pumCd)
                        .data("searchName3", trdName)
                        .data("searchSymbol3", trdCd)
                        .data("searchTrd", trdCd)
                        .timeout(TIMEOUT_MS)
                        .post();
            } catch (Exception e) {
                last = e;
                logger.warn("Nongnet 크롤링 재시도 {}/{} ({} - {}): {}",
                        attempt, MAX_ATTEMPTS, targetDateStr, pumName, e.getMessage());
                if (attempt < MAX_ATTEMPTS) {
                    try {
                        Thread.sleep(RETRY_DELAY_MS);
                    } catch (InterruptedException ignore) {
                        Thread.currentThread().interrupt();
                        return null;
                    }
                }
            }
        }
        logger.error("Nongnet 크롤링 최종 실패 ({} - {}): {}", targetDateStr, pumName,
                last == null ? "unknown" : last.getMessage());
        return null;
    }

    /**
     * GET 요청으로 세션 쿠키(JSESSIONID 등) 획득
     */
    private Map<String, String> acquireSessionCookies() {
        for (int attempt = 1; attempt <= 2; attempt++) {
        try {
            Connection.Response response = Jsoup.connect(URL)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "ko-KR,ko;q=0.9")
                    .method(Connection.Method.GET)
                    .timeout(TIMEOUT_MS)
                    .execute();
            Map<String, String> cookies = response.cookies();
            logger.info("농넷 세션 쿠키 획득: {}", cookies.keySet());
            return cookies;
        } catch (Exception e) {
            logger.warn("농넷 세션 쿠키 획득 실패 {}/2: {}", attempt, e.getMessage());
            if (attempt < 2) {
                try {
                    Thread.sleep(RETRY_DELAY_MS);
                } catch (InterruptedException ignore) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        }
        logger.warn("농넷 세션 쿠키 획득 실패 - 쿠키 없이 진행");
        return Collections.emptyMap();
    }

    private static Map<String, String[]> createTargetItems() {
        Map<String, String[]> items = new LinkedHashMap<>();
        items.put("배추", new String[] { "21100", "10키로망대", "10" });
        items.put("양파", new String[] { "24400", "1키로", "1" });
        items.put("양배추", new String[] { "21200", "8키로망대", "8" });
        items.put("당근", new String[] { "23200", "20키로상자", "20" });
        items.put("홍고추", new String[] { "24210", "10키로상자", "10" });
        return items;
    }
}
