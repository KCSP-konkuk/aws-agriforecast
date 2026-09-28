package com.agriforecast.backend.service;

import com.agriforecast.backend.service.CommunityVoteService.Choice;
import com.agriforecast.backend.util.Soon;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 순 첫날 자동 시세 브리핑 문장. 외부 의존 없음 */
class MarketBriefServiceTest {

    private static final Soon NOW = Soon.parse("202610상순");

    @Test
    void 제목() {
        assertEquals("10월 상순 배추 시세 브리핑", MarketBriefService.title(NOW, "배추"));
    }

    @Test
    void 값이_다_있으면_세_문장() {
        java.util.Map<Choice, Long> votes = new java.util.EnumMap<>(Choice.class);
        votes.put(Choice.UP, 3L); votes.put(Choice.SAME, 1L); votes.put(Choice.DOWN, 0L);
        CommunityVoteService.Last last = CommunityVoteService.judge("202609하순", 13986.0, 13210.0, 13939.0, votes);
        String body = MarketBriefService.body(NOW, "배추", "10키로망대", 13986.0, 13210.0, 13900.0, last);
        assertEquals(String.join("\n",
                "지난 순(9월 하순) 가락시장 배추 경매가는 평균 13,210원(상, 10키로망대)으로 그 전 순보다 5.5% 내렸습니다.",
                "AI 는 이번 순(10월 상순) 평균을 13,900원으로 예측합니다. 지난 순보다 5.2% 높은 값입니다.",
                "지난 순 투표: 참여자 다수 '오른다' · AI '비슷' · 실제 '내린다'."), body);
    }

    @Test
    void 없는_값의_문장은_뺀다() {
        String body = MarketBriefService.body(NOW, "양파", "1키로", null, 1140.0, null, null);
        assertEquals("지난 순(9월 하순) 가락시장 양파 경매가는 평균 1,140원(상, 1키로)입니다.", body);
    }
}
