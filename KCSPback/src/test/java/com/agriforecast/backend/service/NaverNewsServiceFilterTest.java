package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.NaverNewsItem;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 뉴스 선별 규칙(제목 필터·중복 제거·최신순·캐시). 외부 API 없이 돈다(검색 응답을 바꿔 끼운다).
 */
class NaverNewsServiceFilterTest {

    /** 검색어별 응답을 고정하고, 호출 횟수를 센다 */
    static class FakeSearchService extends NaverNewsService {
        final Map<String, List<NaverNewsItem>> byQuery;
        int calls;

        FakeSearchService(Map<String, List<NaverNewsItem>> byQuery) {
            this.byQuery = byQuery;
        }

        @Override
        protected List<NaverNewsItem> search(String query) {
            calls++;
            return byQuery.getOrDefault(query, List.of());
        }
    }

    private static NaverNewsItem news(String title, String pubDate) {
        NaverNewsItem n = new NaverNewsItem();
        n.setTitle(title);
        n.setPubDate(pubDate);
        return n;
    }

    @Test
    void 제목에_농산물_단어가_없는_기사는_뺀다() {
        FakeSearchService s = new FakeSearchService(Map.of("농산물 가격", List.of(
                news("미·중 정상, AI 사고 소통 채널 합의", "Sat, 26 Sep 2026 10:00:00 +0900"),
                news("배추 도매가격 한 달 새 30% 올라", "Sat, 26 Sep 2026 09:00:00 +0900"))));

        List<NaverNewsItem> result = s.getAgriNews();

        assertEquals(1, result.size());
        assertEquals("배추 도매가격 한 달 새 30% 올라", result.get(0).getTitle());
    }

    @Test
    void 여러_검색어에_걸린_같은_기사는_한_번만_최신순으로_낸다() {
        FakeSearchService s = new FakeSearchService(Map.of(
                "농산물 가격", List.of(news("양파값 하락… 농산물 물가 안정", "Fri, 25 Sep 2026 08:00:00 +0900")),
                "양파 가격", List.of(
                        news("양파값 하락...농산물 물가 안정", "Fri, 25 Sep 2026 08:00:00 +0900"),
                        news("고추 작황 부진에 가격 급등", "Sat, 26 Sep 2026 07:00:00 +0900"))));

        List<NaverNewsItem> result = s.getAgriNews();

        assertEquals(List.of("고추 작황 부진에 가격 급등", "양파값 하락… 농산물 물가 안정"),
                result.stream().map(NaverNewsItem::getTitle).toList());
    }

    @Test
    void 결과는_최대_5건이고_다음_조회는_캐시를_쓴다() {
        List<NaverNewsItem> many = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            many.add(news("채소 가격 소식 " + i, String.format("Sat, 26 Sep 2026 %02d:00:00 +0900", i)));
        }
        FakeSearchService s = new FakeSearchService(Map.of("채소 가격", many));

        List<NaverNewsItem> first = s.getAgriNews();
        int callsAfterFirst = s.calls;
        s.getAgriNews();

        assertEquals(5, first.size());
        assertEquals("채소 가격 소식 7", first.get(0).getTitle());
        assertEquals(callsAfterFirst, s.calls);
    }

    @Test
    void 빈_결과는_캐시하지_않아_다음_조회에서_다시_부른다() {
        FakeSearchService s = new FakeSearchService(Map.of());

        s.getAgriNews();
        int callsAfterFirst = s.calls;
        s.getAgriNews();

        assertTrue(s.calls > callsAfterFirst);
    }
}
