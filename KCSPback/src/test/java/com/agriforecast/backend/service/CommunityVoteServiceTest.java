package com.agriforecast.backend.service;

import com.agriforecast.backend.service.CommunityVoteService.Choice;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** 커뮤니티 예측 투표 판정·집계. 외부 의존 없음 */
class CommunityVoteServiceTest {

    @Test
    void 방향은_3퍼센트를_넘어야_오르거나_내린다() {
        assertEquals(Choice.SAME, CommunityVoteService.direction(10000, 10300));   // +3.0% → 비슷
        assertEquals(Choice.UP, CommunityVoteService.direction(10000, 10301));
        assertEquals(Choice.SAME, CommunityVoteService.direction(10000, 9700));    // −3.0% → 비슷
        assertEquals(Choice.DOWN, CommunityVoteService.direction(10000, 9699));
    }

    private static Map<Choice, Long> counts(long up, long same, long down) {
        Map<Choice, Long> m = new EnumMap<>(Choice.class);
        m.put(Choice.UP, up); m.put(Choice.SAME, same); m.put(Choice.DOWN, down);
        return m;
    }

    @Test
    void 참여자_다수는_최다_득표_동률이나_0표면_없음() {
        assertEquals(Choice.UP, CommunityVoteService.majority(counts(5, 3, 1)));
        assertNull(CommunityVoteService.majority(counts(3, 3, 1)));
        assertNull(CommunityVoteService.majority(counts(0, 0, 0)));
    }

    @Test
    void 투표_대상은_다음_순이고_마감은_이번_순_마지막_날() {
        CommunityVoteService.Target t = CommunityVoteService.target(LocalDate.of(2026, 9, 28));
        assertEquals("202610상순", t.code());
        assertEquals("10월 상순", t.label());
        assertEquals(LocalDate.of(2026, 9, 30), t.closesOn());
        assertEquals(2, t.dday());
        assertEquals(0, CommunityVoteService.target(LocalDate.of(2026, 9, 30)).dday());
        assertEquals("202701상순", CommunityVoteService.target(LocalDate.of(2026, 12, 31)).code());
    }

    @Test
    void 지난_순_결과_판정() {
        // T-1 평균 11384, T 실제 13986(+22.9%), AI 12882(+13.2%) → 모두 UP
        CommunityVoteService.Last last = CommunityVoteService.judge(
                "202609중순", 11384.0, 13986.0, 12882.0, counts(4, 1, 0));
        assertEquals(Choice.UP, last.actual());
        assertEquals(Choice.UP, last.ai());
        assertEquals(Choice.UP, last.crowd());
        assertTrue(last.crowdHit());
        assertTrue(last.aiHit());
        assertEquals(13986, last.actualPrice());
        assertEquals("9월 중순", last.label());
    }

    @Test
    void 동률이면_맞선_선택지() {
        assertEquals(List.of(Choice.UP, Choice.DOWN), CommunityVoteService.tied(counts(2, 1, 2)));
        assertEquals(List.of(Choice.UP, Choice.SAME, Choice.DOWN), CommunityVoteService.tied(counts(1, 1, 1)));
        assertEquals(List.of(), CommunityVoteService.tied(counts(3, 1, 0)));
        assertEquals(List.of(), CommunityVoteService.tied(counts(0, 0, 0)));

        CommunityVoteService.Last tie = CommunityVoteService.judge("202609중순", 11384.0, 13986.0, 12882.0, counts(2, 0, 2));
        assertNull(tie.crowd());
        assertEquals(List.of(Choice.UP, Choice.DOWN), tie.crowdTied());
        assertEquals(List.of(), CommunityVoteService.judge("202609중순", 11384.0, 13986.0, 12882.0, counts(3, 0, 1)).crowdTied());
    }

    @Test
    void 값이_없는_칸은_null() {
        CommunityVoteService.Last noActual = CommunityVoteService.judge("202609하순", 13986.0, null, 13939.0, counts(0, 0, 0));
        assertNull(noActual.actual());
        assertNull(noActual.actualPrice());
        assertNull(noActual.aiHit());
        assertNull(noActual.crowd());
        assertNull(noActual.crowdHit());
        assertEquals(Choice.SAME, noActual.ai());

        CommunityVoteService.Last noBase = CommunityVoteService.judge("202609하순", null, 13000.0, 13939.0, counts(1, 0, 0));
        assertNull(noBase.actual());
        assertNull(noBase.ai());
        assertEquals(13939, noBase.aiPrice());
    }

    @Test
    void 선택지와_품목_검증() {
        assertEquals(Choice.UP, CommunityVoteService.parseChoice("UP"));
        assertThrows(IllegalArgumentException.class, () -> CommunityVoteService.parseChoice("up"));
        assertThrows(IllegalArgumentException.class, () -> CommunityVoteService.parseChoice(null));
        assertThrows(IllegalArgumentException.class, () -> CommunityVoteService.checkItem("자유"));
        assertThrows(IllegalArgumentException.class, () -> CommunityVoteService.checkItem("당근"));
        CommunityVoteService.checkItem("홍고추");
    }
}
