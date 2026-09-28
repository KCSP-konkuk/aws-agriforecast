# 커뮤니티 품목방·예측 투표·시세 브리핑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 커뮤니티를 배추·양파·홍고추·자유 방으로 바꾸고, 품목방에 다음 순 가락 경매가 투표·지난 순 결과·자동 시세 브리핑을 넣는다.

**Architecture:** 순 계산은 공용 `Soon` 유틸. 투표는 새 `community_vote` 테이블 + `CommunityVoteService`(판정·집계는 static 순수 함수) + 별도 `CommunityVoteController`. 브리핑은 `posts.KIND` 컬럼 + `MarketBriefService`(본문은 static 함수) + 스케줄러. 시스템 계정·카테고리 이관은 기동 시 초기화 컴포넌트. 프론트는 `Community.jsx` 를 방 구조로 다시 쓰고 `VoteCard` 컴포넌트를 분리한다.

**Tech Stack:** Spring Boot 3 / JPA / JdbcTemplate / JUnit 5 / WebMvcTest · React + Tailwind

**Spec:** `docs/superpowers/specs/2026-09-28-community-crop-rooms-design.md`

## Global Constraints

- 방(category) 값: `배추` · `양파` · `홍고추` · `자유`. 투표·브리핑 품목은 앞의 셋
- 순: 1~10일 상순 · 11~20일 중순 · 21일~말일 하순. 코드 `202610상순`, 라벨 `10월 상순`
- 판정 임계값 3% (상수 `THRESHOLD_PCT = 3.0`): 변화율 > +3 → UP, < −3 → DOWN, 그 외 SAME (±3.0 은 SAME)
- 투표 대상 = 오늘(KST) 순의 다음 순. 마감 = 오늘 순 마지막 날. 지난 결과 = 오늘 순의 이전 순
- 가격 = `agri_price` 일별 상 등급 값의 순 내 평균 / AI 예측가 = `{item}_predictions` 없으면 `{item}_backtest`
- 선택지 `UP` · `SAME` · `DOWN`
- 시각은 전부 KST 명시 (`ZoneId.of("Asia/Seoul")`) — 서버 TZ 가 UTC
- 브리핑: 순 첫날 12:10 KST, 작성자 시스템 계정 `agriforecast` / 이름 `AgriForecast`, `KIND='BRIEF'`, 제목 `10월 상순 배추 시세 브리핑` 으로 중복 판별
- 화면: 작은 회색 설명 줄 금지, 굵기 제목 600 · 숫자 500 · 본문 400, 12px 이하 글씨 금지, 색은 등락·선택·브랜드 초록만
- 커밋 제목 `type: 명사형`, 협업 푸터 없음

## Review Focus

- 오늘이 말일(예: 9/30)일 때 대상 순은 10월 상순, D-day 는 0 (Task 1 테스트)
- 12월 하순 → 다음 순 1월 상순(연도 넘김), 1월 상순 → 이전 순 12월 하순 (Task 1 테스트)
- 로그인 없이 GET 투표 현황은 되고 `myChoice` 는 null, POST 는 401 (Task 3 테스트)
- 잘못된 품목(`자유`, `당근`)·선택지(`up`, 빈값) → 400 (Task 3 테스트)
- 가격 데이터가 없는 순(수집 전)·예측 테이블 없음에서 500 이 아니라 해당 칸 null (Task 2 테스트 + JdbcTemplate 예외 처리)

---

### Task 1: `Soon` 공용 유틸 + RetailPriceService 이관

**Files:**
- Create: `KCSPback/src/main/java/com/agriforecast/backend/util/Soon.java`
- Modify: `KCSPback/src/main/java/com/agriforecast/backend/service/RetailPriceService.java` (soonStart·previousSoonStart·soonLabel 을 Soon 위임으로)
- Test: `KCSPback/src/test/java/com/agriforecast/backend/util/SoonTest.java`

**Interfaces:**
- Produces: `record Soon(int year, int month, int part)` part 1=상순 2=중순 3=하순
  - `static Soon of(LocalDate)`, `static Soon parse(String code)` (`202610상순`), `String code()`, `String label()` (`10월 상순`), `LocalDate start()`, `LocalDate end()`, `Soon next()`, `Soon previous()`, `boolean contains(LocalDate)`

- [ ] **Step 1: 실패하는 테스트**

```java
package com.agriforecast.backend.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** 순(상·중·하) 계산. 외부 의존 없음 */
class SoonTest {

    @Test
    void 날짜로_순을_정한다() {
        assertEquals("202609상순", Soon.of(LocalDate.of(2026, 9, 10)).code());
        assertEquals("202609중순", Soon.of(LocalDate.of(2026, 9, 11)).code());
        assertEquals("202609중순", Soon.of(LocalDate.of(2026, 9, 20)).code());
        assertEquals("202609하순", Soon.of(LocalDate.of(2026, 9, 21)).code());
        assertEquals("202602하순", Soon.of(LocalDate.of(2026, 2, 28)).code());
    }

    @Test
    void 시작일과_끝일() {
        Soon s = Soon.of(LocalDate.of(2026, 9, 25));
        assertEquals(LocalDate.of(2026, 9, 21), s.start());
        assertEquals(LocalDate.of(2026, 9, 30), s.end());
        assertEquals(LocalDate.of(2026, 2, 28), Soon.of(LocalDate.of(2026, 2, 22)).end());
        assertEquals(LocalDate.of(2026, 10, 10), Soon.of(LocalDate.of(2026, 10, 1)).end());
    }

    @Test
    void 다음_이전_순은_월과_연도를_넘는다() {
        assertEquals("202610상순", Soon.of(LocalDate.of(2026, 9, 30)).next().code());
        assertEquals("202701상순", Soon.of(LocalDate.of(2026, 12, 25)).next().code());
        assertEquals("202512하순", Soon.of(LocalDate.of(2026, 1, 3)).previous().code());
        assertEquals("202609상순", Soon.of(LocalDate.of(2026, 9, 15)).previous().code());
    }

    @Test
    void 코드_파싱과_라벨() {
        Soon s = Soon.parse("202610상순");
        assertEquals(LocalDate.of(2026, 10, 1), s.start());
        assertEquals("10월 상순", s.label());
        assertThrows(IllegalArgumentException.class, () -> Soon.parse("2026-10"));
        assertTrue(s.contains(LocalDate.of(2026, 10, 10)));
        assertFalse(s.contains(LocalDate.of(2026, 10, 11)));
    }
}
```

- [ ] **Step 2: 실패 확인** — Run: `cd KCSPback && ./gradlew test --tests 'com.agriforecast.backend.util.SoonTest' -q` / Expected: 컴파일 실패(Soon 없음)

- [ ] **Step 3: 구현** — `Soon.java`

```java
package com.agriforecast.backend.util;

import java.time.LocalDate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 순(10일 단위). 1~10일 상순 · 11~20일 중순 · 21일~말일 하순 — 예측 배치·소매가·커뮤니티 공통 규칙.
 * 코드는 예측 테이블 target_date 와 같은 "202610상순".
 */
public record Soon(int year, int month, int part) {

    private static final String[] NAMES = {"상순", "중순", "하순"};
    private static final Pattern CODE = Pattern.compile("^(\\d{4})(\\d{2})(상순|중순|하순)$");

    public Soon {
        if (month < 1 || month > 12 || part < 1 || part > 3) throw new IllegalArgumentException("잘못된 순");
    }

    public static Soon of(LocalDate d) {
        int day = d.getDayOfMonth();
        return new Soon(d.getYear(), d.getMonthValue(), day <= 10 ? 1 : day <= 20 ? 2 : 3);
    }

    public static Soon parse(String code) {
        Matcher m = CODE.matcher(code == null ? "" : code);
        if (!m.matches()) throw new IllegalArgumentException("순 코드 형식이 아님: " + code);
        int part = switch (m.group(3)) { case "상순" -> 1; case "중순" -> 2; default -> 3; };
        return new Soon(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), part);
    }

    public String code() {
        return String.format("%d%02d%s", year, month, NAMES[part - 1]);
    }

    public String label() {
        return month + "월 " + NAMES[part - 1];
    }

    public LocalDate start() {
        return LocalDate.of(year, month, part == 1 ? 1 : part == 2 ? 11 : 21);
    }

    public LocalDate end() {
        return part == 3 ? start().withDayOfMonth(start().lengthOfMonth()) : start().plusDays(9);
    }

    public Soon next() {
        return part < 3 ? new Soon(year, month, part + 1) : of(end().plusDays(1));
    }

    public Soon previous() {
        return of(start().minusDays(1));
    }

    public boolean contains(LocalDate d) {
        return !d.isBefore(start()) && !d.isAfter(end());
    }
}
```

- [ ] **Step 4: RetailPriceService 위임** — 세 static 함수 본문을 교체 (시그니처·반환값 그대로, 기존 `RetailPriceServiceTest` 가 그대로 통과해야 한다)

```java
    static LocalDate soonStart(LocalDate d) {
        return Soon.of(d).start();
    }

    static LocalDate previousSoonStart(LocalDate d) {
        return Soon.of(d).previous().start();
    }

    /** 차트 라벨 "2026-09 상순" (Soon.label 은 "9월 상순" — 연도가 필요해 따로 둔다) */
    static String soonLabel(LocalDate d) {
        Soon s = Soon.of(d);
        return String.format("%d-%02d %s", s.year(), s.month(), s.code().substring(6));
    }
```
import 추가 `com.agriforecast.backend.util.Soon`

- [ ] **Step 5: 통과 확인** — Run: `cd KCSPback && ./gradlew test --tests 'com.agriforecast.backend.util.SoonTest' --tests 'com.agriforecast.backend.service.RetailPriceServiceTest' -q` / Expected: PASS (4 + 6)

- [ ] **Step 6: CI 목록** — `.github/workflows/ci.yml` 의 `RetailPriceServiceTest` 줄 아래 `--tests 'com.agriforecast.backend.util.SoonTest' \`

- [ ] **Step 7: 커밋** — `git commit -m "refactor: 순 계산을 공용 유틸로 분리"`

---

### Task 2: 투표 도메인 — 테이블·판정·집계

**Files:**
- Create: `entity/CommunityVote.java`, `repository/CommunityVoteRepository.java`, `service/CommunityVoteService.java`
- Modify: `service/PredictionService.java` (`predictedPrice` 추가), `repository/AgriPriceRepository.java` (변경 없음 — `findByItemNameAndDateRange` 재사용)
- Test: `service/CommunityVoteServiceTest.java`

**Interfaces:**
- Consumes: `Soon` (Task 1), `AgriPriceRepository.findByItemNameAndDateRange(String, int, int)`
- Produces:
  - `enum Choice { UP, SAME, DOWN }` (CommunityVoteService 안)
  - `record Target(String code, String label, LocalDate closesOn, long dday)`
  - `record Last(String code, String label, Choice crowd, Choice ai, Integer aiPrice, Choice actual, Integer actualPrice, Boolean crowdHit, Boolean aiHit)`
  - `record Status(String itemName, Target target, Map<Choice, Long> counts, long total, Choice myChoice, Last last)`
  - `Status status(String itemName, Integer memberId)`, `Status vote(String itemName, String choice, Integer memberId)` — 잘못된 인자 `IllegalArgumentException`
  - static: `Choice direction(double base, double next)`, `Choice majority(Map<Choice, Long>)`, `Target target(LocalDate today)`
  - `PredictionService.predictedPrice(String itemName, String soonCode) : Optional<Double>`
  - `CommunityVoteService.VOTE_ITEMS = List.of("배추","양파","홍고추")`

- [ ] **Step 1: 실패하는 테스트**

```java
package com.agriforecast.backend.service;

import com.agriforecast.backend.service.CommunityVoteService.Choice;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.EnumMap;
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
```

- [ ] **Step 2: 실패 확인** — Run: `cd KCSPback && ./gradlew test --tests 'com.agriforecast.backend.service.CommunityVoteServiceTest' -q` / Expected: 컴파일 실패

- [ ] **Step 3: 엔티티** — `CommunityVote.java`

```java
package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** 커뮤니티 '다음 순 오를까' 투표. 품목·대상 순·회원마다 한 표 (다시 누르면 바뀐다) */
@Entity
@Table(name = "community_vote", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"ITEM_NAME", "TARGET_SOON", "MEMBER_ID"})
})
@Getter
@Setter
@NoArgsConstructor
public class CommunityVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ITEM_NAME", nullable = false, length = 20)
    private String itemName;

    /** 예측 테이블 target_date 와 같은 "202610상순" */
    @Column(name = "TARGET_SOON", nullable = false, length = 16)
    private String targetSoon;

    /** member_user.SEQ_NO_A010 */
    @Column(name = "MEMBER_ID", nullable = false)
    private Integer memberId;

    /** UP · SAME · DOWN */
    @Column(name = "CHOICE", nullable = false, length = 8)
    private String choice;

    @UpdateTimestamp
    @Column(name = "UPDATED_AT", nullable = false)
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 4: 리포지토리** — `CommunityVoteRepository.java`

```java
package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.CommunityVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CommunityVoteRepository extends JpaRepository<CommunityVote, Long> {

    Optional<CommunityVote> findByItemNameAndTargetSoonAndMemberId(String itemName, String targetSoon, Integer memberId);

    /** [choice, count] */
    @Query("SELECT v.choice, COUNT(v) FROM CommunityVote v WHERE v.itemName = :itemName AND v.targetSoon = :targetSoon GROUP BY v.choice")
    List<Object[]> countByChoice(String itemName, String targetSoon);
}
```

- [ ] **Step 5: PredictionService 에 추가** (기존 `ITEM_TABLE` 재사용, 테이블이 없으면 빈 값)

```java
    /** 그 순의 AI 예측가. 운영 예측(_predictions) 우선, 없으면 백테스트(_backtest). 테이블이 없으면 빈 값 */
    public Optional<Double> predictedPrice(String itemName, String soonCode) {
        String live = ITEM_TABLE.get(itemName);
        if (live == null) return Optional.empty();
        for (String table : List.of(live, live.replace("_predictions", "_backtest"))) {
            try {
                List<Double> found = jdbcTemplate.query(
                        "SELECT predicted_price FROM " + table + " WHERE target_date = ?",
                        (rs, i) -> rs.getDouble(1), soonCode);
                if (!found.isEmpty()) return Optional.of(found.get(0));
            } catch (org.springframework.dao.DataAccessException e) {
                // 테이블이 아직 없으면 다음 후보로
            }
        }
        return Optional.empty();
    }
```
import 추가 필요 시 `java.util.Optional`

- [ ] **Step 6: 서비스** — `CommunityVoteService.java`

```java
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
        return new Last(code, Soon.parse(code).label(), crowd, aiDir,
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

    public record Last(String code, String label, Choice crowd, Choice ai, Integer aiPrice,
                       Choice actual, Integer actualPrice, Boolean crowdHit, Boolean aiHit) {}

    public record Status(String itemName, Target target, Map<Choice, Long> counts, long total,
                         Choice myChoice, Last last) {}
}
```

- [ ] **Step 7: 통과 확인** — Run: `cd KCSPback && ./gradlew test --tests 'com.agriforecast.backend.service.CommunityVoteServiceTest' -q` / Expected: PASS (6)
- [ ] **Step 8: CI 목록** — `--tests 'com.agriforecast.backend.service.CommunityVoteServiceTest' \`
- [ ] **Step 9: 커밋** — `git commit -m "feat: 커뮤니티 다음 순 예측 투표 판정·집계 추가"`

---

### Task 3: 투표 API

**Files:**
- Create: `controller/CommunityVoteController.java`
- Test: `controller/CommunityVoteControllerTest.java` (WebMvcTest, CommunityAuthTest 와 같은 틀)

**Interfaces:**
- Consumes: `CommunityVoteService.status/vote`
- Produces: `GET /api/community/votes/{itemName}` (로그인 선택) · `POST /api/community/votes/{itemName}` body `{"choice":"UP"}` (로그인 필요) → `Status`. 잘못된 인자 400 `{message}`

- [ ] **Step 1: 실패하는 테스트**

```java
package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.CommunityVoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 커뮤니티 투표 API 의 인증·입력 검증. DB 없이 컨트롤러와 보안 설정만 띄운다 */
@WebMvcTest(CommunityVoteController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class CommunityVoteControllerTest {

    @Autowired MockMvc mvc;
    @Autowired JwtProvider jwtProvider;
    @MockitoBean CommunityVoteService voteService;
    @MockitoBean AccountService accountService;

    @BeforeEach
    void activeUsers() {
        when(accountService.isActive(any())).thenReturn(true);
    }

    @Test
    void 로그인_없이도_현황은_보이고_내_선택은_없다() throws Exception {
        mvc.perform(get("/api/community/votes/배추")).andExpect(status().isOk());
        verify(voteService).status(eq("배추"), isNull());
    }

    @Test
    void 로그인하면_내_번호로_현황을_묻는다() throws Exception {
        String token = jwtProvider.issue(7);
        mvc.perform(get("/api/community/votes/배추").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        verify(voteService).status(eq("배추"), eq(7));
    }

    @Test
    void 토큰_없이_투표하면_401() throws Exception {
        mvc.perform(post("/api/community/votes/배추").contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"UP\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(voteService);
    }

    @Test
    void 잘못된_품목이나_선택지는_400() throws Exception {
        when(voteService.vote(eq("자유"), any(), any())).thenThrow(new IllegalArgumentException("투표 품목이 아님: 자유"));
        String token = jwtProvider.issue(7);
        mvc.perform(post("/api/community/votes/자유").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"UP\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("투표 품목이 아님: 자유"));
    }
}
```
(토큰 발급은 `JwtProvider.issue(Integer)` — CommunityAuthTest 와 같다)

- [ ] **Step 2: 실패 확인** — Run: `./gradlew test --tests 'com.agriforecast.backend.controller.CommunityVoteControllerTest' -q` / Expected: 컴파일 실패

- [ ] **Step 3: 컨트롤러**

```java
package com.agriforecast.backend.controller;

import com.agriforecast.backend.service.CommunityVoteService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 커뮤니티 품목방 '다음 순 오를까' 투표. POST 는 SecurityConfig 의 /api/community/** 규칙으로 로그인 필요 */
@RestController
@RequestMapping("/api/community/votes")
public class CommunityVoteController {

    private final CommunityVoteService voteService;

    public CommunityVoteController(CommunityVoteService voteService) {
        this.voteService = voteService;
    }

    @GetMapping("/{itemName}")
    public ResponseEntity<?> status(@PathVariable String itemName, @AuthenticationPrincipal Integer userId) {
        try {
            return ResponseEntity.ok(voteService.status(itemName, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{itemName}")
    public ResponseEntity<?> vote(@PathVariable String itemName, @RequestBody Map<String, String> body,
                                  @AuthenticationPrincipal Integer userId) {
        try {
            return ResponseEntity.ok(voteService.vote(itemName, body.get("choice"), userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
```

- [ ] **Step 4: 통과 확인** + 기존 `CommunityAuthTest` 도 통과 — Run: `./gradlew test --tests 'com.agriforecast.backend.controller.CommunityVoteControllerTest' --tests 'com.agriforecast.backend.controller.CommunityAuthTest' -q`
- [ ] **Step 5: CI 목록** — `--tests 'com.agriforecast.backend.controller.CommunityVoteControllerTest' \`
- [ ] **Step 6: 커밋** — `git commit -m "feat: 커뮤니티 예측 투표 API 추가"`

---

### Task 4: 시세 브리핑·시스템 계정·방 이관

**Files:**
- Modify: `entity/Post.java` (`kind`), `dto/PostResponse.java` (`kind`), `service/PostService.java` (convertToResponse 에 kind), `repository/PostRepository.java` (`existsByCategoryAndTitle`, `@Modifying` 이관 쿼리)
- Create: `service/MarketBriefService.java`, `scheduler/MarketBriefScheduler.java`, `config/CommunitySetup.java`
- Modify: `controller/DataCollectController.java` (`POST /api/collect/community/brief`)
- Test: `service/MarketBriefServiceTest.java`

**Interfaces:**
- Consumes: `Soon`, `CommunityVoteService.soonAverage(String, Soon)`, `CommunityVoteService.last(String, Soon)` (package-private → 같은 패키지), `PredictionService.predictedPrice`
- Produces: `MarketBriefService.publish(LocalDate today) : int` (새로 쓴 글 수), static `title(Soon, String)`, static `body(...)`; `CommunitySetup.SYSTEM_ID = "agriforecast"`

- [ ] **Step 1: 실패하는 테스트**

```java
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
        CommunityVoteService.Last last = CommunityVoteService.judge("202609하순", 13986.0, 13210.0, 13939.0,
                new java.util.EnumMap<>(java.util.Map.of(Choice.UP, 3L, Choice.SAME, 1L, Choice.DOWN, 0L)));
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
```
(주의: `Map.of` 를 EnumMap 에 넣는 부분은 컴파일되게 `new EnumMap<>(Choice.class)` 후 put 으로 바꿔도 된다)

- [ ] **Step 2: 실패 확인** — Expected: 컴파일 실패

- [ ] **Step 3: Post·PostResponse·PostService·PostRepository**
  - `Post`: `@Column(name = "KIND", length = 10) private String kind;` (null = 사용자 글)
  - `PostResponse`: `private String kind;` / `convertToResponse` 에 `response.setKind(post.getKind() == null ? "USER" : post.getKind());`
  - `PostRepository`:
    ```java
    boolean existsByCategoryAndTitle(String category, String title);

    @Modifying
    @Transactional
    @Query("UPDATE Post p SET p.category = '자유' WHERE p.category NOT IN ('배추', '양파', '홍고추', '자유')")
    int moveLegacyCategoriesToFree();
    ```

- [ ] **Step 4: MarketBriefService**

```java
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
        if (author == null) {
            logger.warn("시스템 계정이 없어 시세 브리핑을 건너뜀");
            return 0;
        }
        Soon now = Soon.of(today);
        Soon prev = now.previous();
        int written = 0;
        for (String item : CommunityVoteService.VOTE_ITEMS) {
            String title = title(now, item);
            if (postRepository.existsByCategoryAndTitle(item, title)) continue;
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
            lines.add(String.format("지난 순 투표: 참여자 다수 %s · AI %s · 실제 '%s'.",
                    last.crowd() == null ? "없음" : "'" + WORD.get(last.crowd()) + "'",
                    last.ai() == null ? "없음" : "'" + WORD.get(last.ai()) + "'",
                    WORD.get(last.actual())));
        }
        return String.join("\n", lines);
    }
}
```

- [ ] **Step 5: CommunitySetup** (기동 시 1회: 시스템 계정 + 옛 카테고리 이관)

```java
package com.agriforecast.backend.config;

import com.agriforecast.backend.entity.AuthPassword;
import com.agriforecast.backend.entity.MemberProfile;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import com.agriforecast.backend.repository.PostRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;

/** 커뮤니티 품목방 준비: 브리핑 작성자 시스템 계정, 옛 카테고리 글을 '자유'로 (둘 다 멱등) */
@Component
public class CommunitySetup {

    public static final String SYSTEM_ID = "agriforecast";
    private static final Logger logger = LoggerFactory.getLogger(CommunitySetup.class);

    private final MemberUserRepository memberUserRepository;
    private final PostRepository postRepository;
    private final PasswordEncoder passwordEncoder;

    public CommunitySetup(MemberUserRepository memberUserRepository, PostRepository postRepository,
                          PasswordEncoder passwordEncoder) {
        this.memberUserRepository = memberUserRepository;
        this.postRepository = postRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void prepare() {
        if (memberUserRepository.findByUserId(SYSTEM_ID).isEmpty()) {
            SecureRandom random = new SecureRandom();
            byte[] secret = new byte[32];
            random.nextBytes(secret);
            byte[] salt = new byte[16];
            random.nextBytes(salt);

            MemberUser user = new MemberUser();
            user.setId(SYSTEM_ID);
            user.setIsActive(true);
            AuthPassword pw = new AuthPassword();
            pw.setMemberUser(user);
            pw.setSalt(Base64.getEncoder().encodeToString(salt));
            pw.setPassword(passwordEncoder.encode(Base64.getEncoder().encodeToString(secret)));  // 아무도 모르는 값 → 로그인 불가
            MemberProfile profile = new MemberProfile();
            profile.setMemberUser(user);
            profile.setName("AgriForecast");
            user.setAuthPassword(pw);
            user.setMemberProfile(profile);
            memberUserRepository.save(user);
            logger.info("커뮤니티 시스템 계정 생성: {}", SYSTEM_ID);
        }
        int moved = postRepository.moveLegacyCategoriesToFree();
        if (moved > 0) logger.info("옛 카테고리 글 {}건을 '자유'로 옮김", moved);
    }
}
```
(`PasswordEncoder` 빈은 SecurityConfig.passwordEncoder())

- [ ] **Step 6: 스케줄러 + 수동 트리거**

```java
package com.agriforecast.backend.scheduler;

import com.agriforecast.backend.service.MarketBriefService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/** 순 첫날(1·11·21일) 12:10 KST — 일별 가격 수집(11:00, 전날분) 뒤에 시세 브리핑 */
@Component
public class MarketBriefScheduler {

    private final MarketBriefService marketBriefService;

    public MarketBriefScheduler(MarketBriefService marketBriefService) {
        this.marketBriefService = marketBriefService;
    }

    @Scheduled(cron = "0 10 12 1,11,21 * *", zone = "Asia/Seoul")
    public void publish() {
        marketBriefService.publish(LocalDate.now(ZoneId.of("Asia/Seoul")));
    }
}
```
DataCollectController: 생성자에 `MarketBriefService` 추가하고
```java
    /**
     * 시세 브리핑 수동 작성 (오늘 순, 이미 있으면 건너뜀)
     * POST /api/collect/community/brief
     */
    @PostMapping("/community/brief")
    public ResponseEntity<Map<String, Object>> publishBrief() {
        int written = marketBriefService.publish(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")));
        return ResponseEntity.ok(Map.of("written", written));
    }
```

- [ ] **Step 7: 통과 확인** — `MarketBriefServiceTest` + CI 백엔드 전체 — Expected: PASS
- [ ] **Step 8: CI 목록** — `--tests 'com.agriforecast.backend.service.MarketBriefServiceTest' \`
- [ ] **Step 9: 커밋** — `git commit -m "feat: 품목방 시세 브리핑 자동 작성과 방 이관 추가"`

---

### Task 5: 커뮤니티 화면

**Files:**
- Modify: `KCSPfront/src/api/api.js` (`getVoteStatus`, `vote`)
- Create: `KCSPfront/src/components/VoteCard.jsx`
- Modify: `KCSPfront/src/pages/Community.jsx` (방 구조로 다시 씀), `CommunityWrite.jsx`·`CommunityEdit.jsx` (카테고리 4개, `?category=` 기본값)
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: Task 3 응답 `Status` (JSON: `target{code,label,closesOn,dday}`, `counts{UP,SAME,DOWN}`, `total`, `myChoice`, `last{label,crowd,ai,aiPrice,actual,actualPrice,crowdHit,aiHit}`), 게시글 `kind`
- Produces: `api.getVoteStatus(itemName)`, `api.vote(itemName, choice)` (401 → `needsLogin`), `<VoteCard itemName unit />`, `ROOMS = ['배추','양파','홍고추','자유']`

- [ ] **Step 1: api.js** (`getPostsByCategory` 아래)

```js
  // 품목방 '다음 순 오를까' 투표 현황 (로그인했으면 내 선택 포함)
  getVoteStatus: async (itemName) => {
    const response = await fetch(`${API_BASE_URL}/community/votes/${encodeURIComponent(itemName)}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('투표 현황을 불러오지 못했습니다.');
    return await response.json();
  },

  // 투표 (로그인 필요 — 401 이면 needsLogin 오류)
  vote: (itemName, choice) =>
    authorizedRequest(
      `${API_BASE_URL}/community/votes/${encodeURIComponent(itemName)}`,
      { method: 'POST', body: JSON.stringify({ choice }) },
      '투표하지 못했습니다.'
    ),
```

- [ ] **Step 2: VoteCard.jsx** — A안(카드 톤·낮춘 굵기). 설명용 작은 회색 줄 없음

```jsx
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/api';
import { isLoggedIn, loginPath } from '../auth';

const OPTIONS = [
  { key: 'UP', label: '▲ 오른다', color: 'text-price-up', ring: 'border-price-up ring-1 ring-price-up', fill: 'bg-price-up/10' },
  { key: 'SAME', label: '― 비슷', color: 'text-text-main', ring: 'border-text-main/60 ring-1 ring-text-main/60', fill: 'bg-gray-100' },
  { key: 'DOWN', label: '▼ 내린다', color: 'text-price-down', ring: 'border-price-down ring-1 ring-price-down', fill: 'bg-price-down/10' },
];
const WORD = { UP: '▲ 오른다', SAME: '― 비슷', DOWN: '▼ 내린다' };
const TONE = { UP: 'text-price-up', SAME: 'text-text-main', DOWN: 'text-price-down' };
const won = (v) => `${Math.round(v).toLocaleString()}원`;

function ResultRow({ label, dir, price, hit }) {
  return (
    <tr>
      <td className="py-1.5 text-text-main/80">{label}</td>
      <td className="py-1.5 text-right">
        {dir ? <span className={TONE[dir]}>{price != null ? `${WORD[dir].slice(0, 1)} ${won(price)}` : WORD[dir]}</span> : <span className="text-subtext-light">-</span>}
        {hit === true && <span className="ml-2 font-semibold text-primary">적중</span>}
      </td>
    </tr>
  );
}

export default function VoteCard({ itemName }) {
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError('');
    setNeedsLogin(false);
    api.getVoteStatus(itemName)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setError('투표를 불러오지 못했습니다.'); });
    return () => { cancelled = true; };
  }, [itemName]);

  const choose = async (key) => {
    if (!isLoggedIn()) { setNeedsLogin(true); return; }
    if (sending || status?.myChoice === key) return;
    setSending(true);
    try {
      setStatus(await api.vote(itemName, key));
    } catch (err) {
      if (err.needsLogin) setNeedsLogin(true);
      else setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (error && !status) return <div className="rounded-xl border border-border-light bg-white p-6 text-text-main/80">{error}</div>;
  if (!status) return <div className="h-56 rounded-xl border border-border-light bg-white animate-pulse" />;

  const { target, counts, total, myChoice, last } = status;
  const pct = (key) => (total > 0 ? Math.round((counts[key] / total) * 100) : 0);

  return (
    <section className="rounded-xl border border-border-light bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-text-main">{target.label} {itemName}값, 오를까요?</h2>
        <span className="shrink-0 rounded-md bg-primary-light px-2.5 py-1 text-sm font-semibold text-primary">
          {target.dday === 0 ? '오늘 마감' : `D-${target.dday}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const selected = myChoice === o.key;
          return (
            <button
              key={o.key}
              type="button"
              disabled={sending}
              onClick={() => choose(o.key)}
              className={`relative overflow-hidden rounded-lg border px-3 py-3 text-left transition ${selected ? o.ring : 'border-border-light hover:border-primary/40'}`}
            >
              <span className={`absolute inset-x-0 bottom-0 ${selected ? o.fill : 'bg-gray-50'}`} style={{ height: `${pct(o.key)}%` }} />
              <span className={`relative block text-sm ${o.color}`}>{o.label}</span>
              <span className="relative mt-1 block text-2xl font-medium text-text-main">
                {total > 0 ? `${pct(o.key)}%` : ' '}
              </span>
            </button>
          );
        })}
      </div>
      {total === 0 && <p className="mt-3 text-sm text-text-main/70">첫 표를 기다려요</p>}
      {needsLogin && (
        <p className="mt-3 text-sm text-text-main/80">
          투표는 로그인 후 할 수 있어요. <Link to={loginPath(location.pathname + location.search)} className="font-semibold text-primary hover:underline">로그인하기</Link>
        </p>
      )}

      {last && (
        <div className="mt-5 border-t border-border-light pt-4">
          <h3 className="text-base font-semibold text-text-main">{last.label} 결과</h3>
          <table className="mt-2 w-full text-[15px]">
            <tbody>
              <ResultRow label="참여자 예측" dir={last.crowd} hit={last.crowdHit} />
              <ResultRow label="AI 예측" dir={last.ai} price={last.aiPrice} hit={last.aiHit} />
              <ResultRow label="실제" dir={last.actual} price={last.actualPrice} />
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Community.jsx 다시 쓰기** — 제목 "커뮤니티", 알약 탭 4개(기존 스타일 유지), 품목방이면 `<VoteCard>`, "{방} 이야기" + 글쓰기(`/community/write?category=방`), 글 목록(흰 카드·구분선): 최신 BRIEF 1개를 맨 위(`bg-primary-light`, 초록 제목), 한 줄 = 제목 + 댓글 수(초록) · 오른쪽 상대 시간. 페이지네이션 유지. 탭은 `?room=` 쿼리로 유지

```jsx
import Layout from '../components/Layout';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/api';
import VoteCard from '../components/VoteCard';

export const ROOMS = ['배추', '양파', '홍고추', '자유'];
const VOTE_ROOMS = ['배추', '양파', '홍고추'];

// "2시간 전" · "어제" · "09.21"
function when(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}시간 전`;
  if (diffMin < 60 * 48) return '어제';
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function Community() {
  const [params, setParams] = useSearchParams();
  const room = ROOMS.includes(params.get('room')) ? params.get('room') : ROOMS[0];
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('loading');

  useEffect(() => { setPage(0); }, [room]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    api.getPostsByCategory(room, page, 10)
      .then((res) => {
        if (cancelled) return;
        setPosts(res.content || []);
        setTotalPages(res.totalPages || 1);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) { setPosts([]); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [room, page]);

  // 최신 브리핑 1개만 맨 위로, 나머지 브리핑은 목록에서 일반 글처럼
  const briefIndex = page === 0 ? posts.findIndex((p) => p.kind === 'BRIEF') : -1;
  const ordered = briefIndex > 0 ? [posts[briefIndex], ...posts.filter((_, i) => i !== briefIndex)] : posts;

  return (
    <Layout>
      <main className="flex flex-1 justify-center px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col max-w-[880px] flex-1 min-w-0">
          <h1 className="text-text-main text-3xl sm:text-4xl font-bold tracking-[-0.02em] mb-6">커뮤니티</h1>

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {ROOMS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setParams({ room: r })}
                className={`h-9 shrink-0 rounded-lg px-4 text-sm ${r === room ? 'bg-primary text-white font-semibold' : 'bg-primary-light text-text-main font-medium hover:bg-primary/15'}`}
              >
                {r}
              </button>
            ))}
          </div>

          {VOTE_ROOMS.includes(room) && <VoteCard itemName={room} />}

          <div className="flex items-center justify-between mt-8 mb-3">
            <h2 className="text-lg font-semibold text-text-main">{room === '자유' ? '자유 이야기' : `${room} 이야기`}</h2>
            <Link to={`/community/write?category=${encodeURIComponent(room)}`} className="h-9 inline-flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">
              글쓰기
            </Link>
          </div>

          <div className="rounded-xl border border-border-light bg-white overflow-hidden">
            {status === 'loading' ? (
              <div className="h-40 animate-pulse" />
            ) : status === 'error' ? (
              <p className="px-5 py-10 text-center text-text-main/80">글을 불러오지 못했습니다.</p>
            ) : ordered.length === 0 ? (
              <p className="px-5 py-10 text-center text-text-main/80">아직 글이 없어요. 첫 이야기를 남겨 보세요.</p>
            ) : (
              ordered.map((post, i) => {
                const pinned = i === 0 && post.kind === 'BRIEF' && page === 0;
                return (
                  <Link
                    key={post.id}
                    to={`/community/${post.id}`}
                    className={`flex items-center justify-between gap-4 px-5 py-4 text-[15px] ${i > 0 ? 'border-t border-border-light' : ''} ${pinned ? 'bg-primary-light' : 'hover:bg-background-light'}`}
                  >
                    <span className="min-w-0 truncate">
                      <span className={pinned ? 'font-medium text-primary' : 'text-text-main'}>{post.title}</span>
                      {post.commentCount > 0 && <span className="ml-2 font-medium text-primary">{post.commentCount}</span>}
                    </span>
                    <span className="shrink-0 text-sm text-text-main/60">{when(post.createdAt)}</span>
                  </Link>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {Array.from({ length: Math.min(10, totalPages) }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={`h-8 w-8 rounded-lg text-sm ${page === i ? 'bg-primary text-white font-semibold' : 'text-text-main hover:bg-primary-light'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}
```

- [ ] **Step 4: CommunityWrite / CommunityEdit** — 카테고리 `<select>` 옵션을 `ROOMS` 로. Write 는 `useSearchParams` 의 `category` 가 ROOMS 에 있으면 기본값, 없으면 `'자유'`. 저장 후 이동은 그대로. Edit 는 기존 글의 category 가 ROOMS 밖이면 `'자유'` 로 표시
- [ ] **Step 5: PROGRESS.md** — 3절 진행 중에 이 PR, 4.4 에 "홈 카드 증감 기준(하루 가격 vs 순 평균) — 지금 유지, 나중에 비교 기준만 변경", 4.3 에 KAMIS 과거 자료 회신 후 모델
- [ ] **Step 6: 빌드** — `cd KCSPfront && npm run build` / Expected: `✓ built`
- [ ] **Step 7: 화면 확인** — scratchpad 임시 서버로 `/api/community/votes/*`(예시 응답)·`/api/community/posts/category/*`(BRIEF 포함 예시)를 흉내 내고 나머지는 운영 프록시. 데스크톱·375px iframe 캡처. Expected: 탭 4개, 투표 카드(D-day, 3칸, 결과 표), 브리핑 고정 줄, 가로 넘침 없음
- [ ] **Step 8: 커밋** — `git commit -m "feat: 커뮤니티를 품목방과 예측 투표 화면으로 개편"`
