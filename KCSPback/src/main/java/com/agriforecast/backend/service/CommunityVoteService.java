package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.AgriPrice;
import com.agriforecast.backend.entity.CommunityVote;
import com.agriforecast.backend.repository.AgriPriceRepository;
import com.agriforecast.backend.repository.CommunityVoteRepository;
import com.agriforecast.backend.util.Soon;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 커뮤니티 '다음 순 가락 경매가, 오를까?' 투표.
 * 대상 = 오늘 순의 다음 순, 마감 = 오늘 순 마지막 날, 지난 결과 = 오늘 순의 이전 순.
 * 가격 = agri_price 일별 상 등급 값의 순 평균 (상세 화면·AI 예측과 같은 기준)
 */
@Service
public class CommunityVoteService {

    public enum Choice { UP, SAME, DOWN }

    public static final List<String> VOTE_ITEMS = List.of("배추", "양파", "홍고추");
    static final double THRESHOLD_PCT = 3.0;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final CommunityVoteRepository voteRepository;
    private final AgriPriceRepository agriPriceRepository;
    private final PredictionService predictionService;

    public CommunityVoteService(CommunityVoteRepository voteRepository,
                                AgriPriceRepository agriPriceRepository,
                                PredictionService predictionService) {
        this.voteRepository = voteRepository;
        this.agriPriceRepository = agriPriceRepository;
        this.predictionService = predictionService;
    }

    public Status status(String itemName, Integer memberId) {
        checkItem(itemName);
        LocalDate today = LocalDate.now(KST);
        Target target = target(today);
        Map<Choice, Long> counts = counts(itemName, target.code());
        Choice mine = memberId == null ? null
                : voteRepository.findByItemNameAndTargetSoonAndMemberId(itemName, target.code(), memberId)
                        .map(v -> Choice.valueOf(v.getChoice())).orElse(null);
        return new Status(itemName, target, counts, total(counts), mine, last(itemName, Soon.of(today).previous()));
    }

    @Transactional
    public Status vote(String itemName, String choice, Integer memberId) {
        checkItem(itemName);
        Choice c = parseChoice(choice);
        if (memberId == null) throw new IllegalArgumentException("로그인이 필요합니다.");
        String code = target(LocalDate.now(KST)).code();
        CommunityVote v = voteRepository.findByItemNameAndTargetSoonAndMemberId(itemName, code, memberId)
                .orElseGet(CommunityVote::new);
        v.setItemName(itemName);
        v.setTargetSoon(code);
        v.setMemberId(memberId);
        v.setChoice(c.name());
        voteRepository.save(v);
        return status(itemName, memberId);
    }

    /** 끝난 순 T 의 결과 (T-1 평균 대비) */
    Last last(String itemName, Soon t) {
        Double base = soonAverage(itemName, t.previous());
        Double actual = soonAverage(itemName, t);
        Double ai = predictionService.predictedPrice(itemName, t.code()).orElse(null);
        return judge(t.code(), base, actual, ai, counts(itemName, t.code()));
    }

    /** 품목의 그 순 경매가 평균. 데이터가 없으면 null */
    public Double soonAverage(String itemName, Soon s) {
        int from = key(s.start()), to = key(s.end());
        OptionalDouble avg = agriPriceRepository.findByItemNameAndDateRange(itemName, from, to).stream()
                .map(AgriPrice::getAvgPrice).filter(Objects::nonNull).filter(p -> p > 0)
                .mapToDouble(Double::doubleValue).average();
        return avg.isPresent() ? avg.getAsDouble() : null;
    }

    private Map<Choice, Long> counts(String itemName, String code) {
        Map<Choice, Long> m = new EnumMap<>(Choice.class);
        for (Choice c : Choice.values()) m.put(c, 0L);
        for (Object[] row : voteRepository.countByChoice(itemName, code)) {
            try {
                m.put(Choice.valueOf((String) row[0]), ((Number) row[1]).longValue());
            } catch (IllegalArgumentException ignore) {
                // 알 수 없는 값은 세지 않는다
            }
        }
        return m;
    }

    // ---------- 순수 함수 (테스트 대상) ----------

    static Choice direction(double base, double next) {
        double pct = (next - base) / base * 100;
        if (pct > THRESHOLD_PCT) return Choice.UP;
        if (pct < -THRESHOLD_PCT) return Choice.DOWN;
        return Choice.SAME;
    }

    static Choice majority(Map<Choice, Long> counts) {
        Choice best = null;
        long max = 0;
        boolean tie = false;
        for (Choice c : Choice.values()) {
            long n = counts.getOrDefault(c, 0L);
            if (n > max) { max = n; best = c; tie = false; }
            else if (n == max && n > 0) tie = true;
        }
        return tie ? null : best;
    }

    /** 최다 득표가 둘 이상이면 그 선택지들(순서: UP·SAME·DOWN), 아니면 빈 목록 */
    static List<Choice> tied(Map<Choice, Long> counts) {
        long max = counts.values().stream().mapToLong(Long::longValue).max().orElse(0);
        if (max == 0) return List.of();
        List<Choice> top = Arrays.stream(Choice.values())
                .filter(c -> counts.getOrDefault(c, 0L) == max)
                .toList();
        return top.size() > 1 ? top : List.of();
    }

    static Target target(LocalDate today) {
        Soon now = Soon.of(today);
        Soon next = now.next();
        return new Target(next.code(), next.label(), now.end(), ChronoUnit.DAYS.between(today, now.end()));
    }

    static Last judge(String code, Double base, Double actual, Double ai, Map<Choice, Long> counts) {
        Choice actualDir = base != null && actual != null ? direction(base, actual) : null;
        Choice aiDir = base != null && ai != null ? direction(base, ai) : null;
        Choice crowd = majority(counts);
        Boolean crowdHit = actualDir != null && crowd != null ? crowd == actualDir : null;
        Boolean aiHit = actualDir != null && aiDir != null ? aiDir == actualDir : null;
        return new Last(code, Soon.parse(code).label(), crowd, crowd == null ? tied(counts) : List.of(), aiDir,
                ai == null ? null : (int) Math.round(ai), actualDir,
                actual == null ? null : (int) Math.round(actual), crowdHit, aiHit);
    }

    static Choice parseChoice(String choice) {
        if (choice == null) throw new IllegalArgumentException("선택지가 없습니다.");
        try {
            return Choice.valueOf(choice);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("선택지는 UP·SAME·DOWN 중 하나: " + choice);
        }
    }

    static void checkItem(String itemName) {
        if (!VOTE_ITEMS.contains(itemName)) throw new IllegalArgumentException("투표 품목이 아님: " + itemName);
    }

    private static long total(Map<Choice, Long> counts) {
        return counts.values().stream().mapToLong(Long::longValue).sum();
    }

    private static int key(LocalDate d) {
        return d.getYear() * 10000 + d.getMonthValue() * 100 + d.getDayOfMonth();
    }

    public record Target(String code, String label, LocalDate closesOn, long dday) {}

    /** crowd: 동률이거나 표가 없으면 null — 동률이면 crowdTied 에 맞선 선택지들, 표가 없으면 빈 목록 */
    public record Last(String code, String label, Choice crowd, List<Choice> crowdTied, Choice ai, Integer aiPrice,
                       Choice actual, Integer actualPrice, Boolean crowdHit, Boolean aiHit) {}

    public record Status(String itemName, Target target, Map<Choice, Long> counts, long total,
                         Choice myChoice, Last last) {}
}
