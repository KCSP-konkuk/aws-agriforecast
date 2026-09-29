package com.agriforecast.backend.service;

import com.agriforecast.backend.config.CommunitySetup;
import com.agriforecast.backend.entity.Post;
import com.agriforecast.backend.repository.MemberUserRepository;
import com.agriforecast.backend.repository.PostRepository;
import com.agriforecast.backend.service.CommunityVoteService.Choice;
import com.agriforecast.backend.util.Soon;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** 순 첫날 품목방마다 올리는 시세 브리핑 글. 숫자만 채우는 템플릿이고 같은 순 글은 한 번만 쓴다 */
@Service
public class MarketBriefService {

    private static final Logger logger = LoggerFactory.getLogger(MarketBriefService.class);
    static final Map<String, String> UNITS = Map.of("배추", "10키로망대", "양파", "1키로", "홍고추", "10키로상자");
    private static final Map<Choice, String> WORD = Map.of(Choice.UP, "오른다", Choice.SAME, "비슷", Choice.DOWN, "내린다");

    private final PostRepository postRepository;
    private final MemberUserRepository memberUserRepository;
    private final CommunityVoteService voteService;
    private final PredictionService predictionService;

    public MarketBriefService(PostRepository postRepository, MemberUserRepository memberUserRepository,
                              CommunityVoteService voteService, PredictionService predictionService) {
        this.postRepository = postRepository;
        this.memberUserRepository = memberUserRepository;
        this.voteService = voteService;
        this.predictionService = predictionService;
    }

    /** today 가 속한 순의 브리핑을 품목마다 쓴다. 이미 있으면 건너뛴다. 새로 쓴 글 수 */
    public int publish(LocalDate today) {
        var author = memberUserRepository.findByUserId(CommunitySetup.SYSTEM_ID).orElse(null);
        if (!CommunitySetup.isSystemAccount(author)) {
            logger.warn("시스템 계정이 없거나 같은 아이디의 일반 회원이라 시세 브리핑을 건너뜀");
            return 0;
        }
        Soon now = Soon.of(today);
        Soon prev = now.previous();
        int written = 0;
        for (String item : CommunityVoteService.VOTE_ITEMS) {
            String title = title(now, item);
            // 같은 순에 이미 쓴 브리핑이 있으면 건너뛴다 (제목엔 연도가 없어 기간으로 판별)
            if (postRepository.existsByCategoryAndKindAndCreatedAtBetween(item, "BRIEF",
                    now.start().atStartOfDay(), now.end().plusDays(1).atStartOfDay())) continue;
            Double prevPrev = voteService.soonAverage(item, prev.previous());
            Double prevAvg = voteService.soonAverage(item, prev);
            Double ai = predictionService.predictedPrice(item, now.code()).orElse(null);
            CommunityVoteService.Last last = voteService.last(item, prev);
            String body = body(now, item, UNITS.get(item), prevPrev, prevAvg, ai, last);
            if (body.isBlank()) continue;
            Post post = new Post();
            post.setUser(author);
            post.setCategory(item);
            post.setTitle(title);
            post.setContent(body);
            post.setKind("BRIEF");
            post.setViewCount(0);
            postRepository.save(post);
            written++;
        }
        logger.info("시세 브리핑 {} — {}건 작성", now.code(), written);
        return written;
    }

    static String title(Soon now, String item) {
        return now.label() + " " + item + " 시세 브리핑";
    }

    static String body(Soon now, String item, String unit, Double prevPrev, Double prevAvg, Double ai,
                       CommunityVoteService.Last last) {
        Soon prev = now.previous();
        List<String> lines = new ArrayList<>();
        if (prevAvg != null) {
            String head = String.format("지난 순(%s) 가락시장 %s 경매가는 평균 %,d원(상, %s)", prev.label(), item, Math.round(prevAvg), unit);
            if (prevPrev != null) {
                double pct = (prevAvg - prevPrev) / prevPrev * 100;
                lines.add(head + String.format("으로 그 전 순보다 %.1f%% %s.", Math.abs(pct), pct >= 0 ? "올랐습니다" : "내렸습니다"));
            } else {
                lines.add(head + "입니다.");
            }
        }
        if (ai != null) {
            String line = String.format("AI 는 이번 순(%s) 평균을 %,d원으로 예측합니다.", now.label(), Math.round(ai));
            if (prevAvg != null) {
                double pct = (ai - prevAvg) / prevAvg * 100;
                line += String.format(" 지난 순보다 %.1f%% %s 값입니다.", Math.abs(pct), pct >= 0 ? "높은" : "낮은");
            }
            lines.add(line);
        }
        if (last != null && last.actual() != null) {
            lines.add(String.format("지난 순 투표: %s · %s · 실제 '%s'.",
                    last.crowd() == null ? "참여자 없음" : "참여자 다수 '" + WORD.get(last.crowd()) + "'",
                    last.ai() == null ? "AI 예측 없음" : "AI '" + WORD.get(last.ai()) + "'",
                    WORD.get(last.actual())));
        }
        return String.join("\n", lines);
    }
}
