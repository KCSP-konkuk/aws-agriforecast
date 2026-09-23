package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.NaverDataLabResponse;
import com.agriforecast.backend.entity.SearchTrend;
import com.agriforecast.backend.repository.SearchTrendRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * refreshSeries 의 덮어쓰기 규칙. 외부 API·DB 없이 돈다(API 응답과 저장소를 바꿔 끼운다).
 */
class NaverDataLabServiceRefreshTest {

    private static final LocalDate END = LocalDate.of(2026, 9, 22);

    /** API 응답을 고정하고, 요청 기간을 기록한다 */
    static class FakeApiService extends NaverDataLabService {
        final Map<String, Double> points;
        LocalDate requestedStart, requestedEnd;

        FakeApiService(SearchTrendRepository repo, Map<String, Double> points) {
            super(repo);
            this.points = points;
        }

        @Override
        protected NaverDataLabResponse callNaverApi(String keyword, LocalDate startDate, LocalDate endDate) {
            requestedStart = startDate;
            requestedEnd = endDate;
            List<NaverDataLabResponse.DataPoint> data = new ArrayList<>();
            points.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(e -> {
                NaverDataLabResponse.DataPoint dp = new NaverDataLabResponse.DataPoint();
                dp.setPeriod(e.getKey());
                dp.setRatio(e.getValue());
                data.add(dp);
            });
            NaverDataLabResponse.Result r = new NaverDataLabResponse.Result();
            r.setData(data);
            NaverDataLabResponse resp = new NaverDataLabResponse();
            resp.setResults(List.of(r));
            return resp;
        }
    }

    private static SearchTrend row(String period, double ratio) {
        SearchTrend t = new SearchTrend();
        t.setKeyword("배추");
        t.setPeriod(LocalDate.parse(period));
        t.setRatio(ratio);
        return t;
    }

    @SuppressWarnings("unchecked")
    private static List<SearchTrend> saved(SearchTrendRepository repo) {
        ArgumentCaptor<List<SearchTrend>> c = ArgumentCaptor.forClass(List.class);
        verify(repo).saveAll(c.capture());
        return c.getValue();
    }

    @Test
    void 항상_2016년부터_한번에_요청한다() {
        SearchTrendRepository repo = mock(SearchTrendRepository.class);
        when(repo.findByKeywordAndPeriodBetweenOrderByPeriodAsc(any(), any(), any())).thenReturn(List.of());
        FakeApiService s = new FakeApiService(repo, Map.of("2026-09-22", 7.0));

        s.refreshSeries("배추", END);

        assertEquals(LocalDate.of(2016, 1, 1), s.requestedStart);
        assertEquals(END, s.requestedEnd);
        verify(repo).findByKeywordAndPeriodBetweenOrderByPeriodAsc(eq("배추"), eq(LocalDate.of(2016, 1, 1)), eq(END));
    }

    @Test
    void 하루씩_쌓인_100을_바로잡고_빠진_날을_채우고_같은_값은_건드리지_않는다() {
        SearchTrendRepository repo = mock(SearchTrendRepository.class);
        SearchTrend same = row("2026-09-13", 7.7979);
        SearchTrend bad = row("2026-09-14", 100.0);            // 스케줄러가 하루만 받아 넣은 값
        when(repo.findByKeywordAndPeriodBetweenOrderByPeriodAsc(any(), any(), any()))
                .thenReturn(List.of(same, bad));
        FakeApiService s = new FakeApiService(repo, Map.of(
                "2026-09-13", 7.7979, "2026-09-14", 7.6, "2026-09-20", 6.9));

        NaverDataLabService.RefreshResult r = s.refreshSeries("배추", END);

        assertEquals(1, r.inserted());                         // 9/20 결손
        assertEquals(1, r.updated());                          // 9/14 100 → 7.6
        assertEquals(0.0, r.maxShift(), 1e-9);                 // 100 이던 값의 변동은 기준 변동으로 안 친다
        List<SearchTrend> out = saved(repo);
        assertEquals(2, out.size());
        assertEquals(7.6, bad.getRatio(), 1e-9);
        assertTrue(out.stream().noneMatch(t -> t == same));
    }

    @Test
    void 기존_정상값이_바뀌면_변동폭을_기록한다() {
        SearchTrendRepository repo = mock(SearchTrendRepository.class);
        when(repo.findByKeywordAndPeriodBetweenOrderByPeriodAsc(any(), any(), any()))
                .thenReturn(List.of(row("2024-01-15", 100.0), row("2025-05-01", 6.0)));
        // 새 최고치가 나와 전체가 절반으로 다시 맞춰진 상황
        FakeApiService s = new FakeApiService(repo, Map.of("2024-01-15", 50.0, "2025-05-01", 3.0));

        NaverDataLabService.RefreshResult r = s.refreshSeries("배추", END);

        assertEquals(2, r.updated());
        assertEquals(3.0, r.maxShift(), 1e-9);
    }

    @Test
    void 응답이_비면_아무것도_쓰지_않고_실패한다() {
        SearchTrendRepository repo = mock(SearchTrendRepository.class);
        NaverDataLabService s = new NaverDataLabService(repo) {
            @Override
            protected NaverDataLabResponse callNaverApi(String k, LocalDate a, LocalDate b) {
                return new NaverDataLabResponse();
            }
        };

        assertThrows(IllegalStateException.class, () -> s.refreshSeries("배추", END));
        verify(repo, never()).saveAll(any());
    }
}
