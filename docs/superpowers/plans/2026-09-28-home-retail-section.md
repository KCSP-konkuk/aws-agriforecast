# 홈 서울 소매가 섹션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈의 모델 설명 섹션을 KAMIS 서울 소매가(양파·붉은고추·양배추) 카드 3장 + 일별/순별 추이 차트로 바꾼다. 예측 자리는 비워 둔다.

**Architecture:** `retail_price` 를 읽는 `RetailPriceService`(순 판정·순 평균·요약은 순수 static 함수) + `PriceController` 조회 엔드포인트 2개. 프론트는 새 `RetailPriceSection` 컴포넌트가 두 API 를 불러 카드·차트를 그리고 `Home.jsx` 는 한 줄로 넣는다.

**Tech Stack:** Spring Boot 3 / JPA / JUnit 5 · React + Vite + Tailwind + recharts

**Spec:** `docs/superpowers/specs/2026-09-28-home-retail-section-design.md`

## Global Constraints

- 품목·순서·단위 고정: 양파 1kg · 붉은고추 100g · 양배추 1포기 (`KamisRetailService.TARGET_ITEMS` 순서)
- 순 판정: 1~10일 상순, 11~20일 중순, 21일~말일 하순. 라벨 `2025-01 상순`, 대표 날짜는 순 첫날(1·11·21일)
- 순 평균 = 그 순 조사일 값 단순평균, 원 단위 반올림
- `changePct` = (최근 가격 − 직전 순 평균) / 직전 순 평균 × 100, 소수 첫째 자리. 직전 순에 조사일이 없으면 `null` (더 앞 순으로 가지 않음)
- 예측은 **순별에서만** 표시. 지금 `prediction` 은 `null`, `predictions` 는 `[]`
- 출처 문구: "KAMIS Open API · 서울 평균 · 상품 등급 · 매일 갱신"
- 상승 `text-price-up`(빨강) · 하락 `text-price-down`(파랑)
- 커밋 제목 `type: 명사형`, Claude 협업 푸터 없음

## Review Focus

- 최근 조사일이 월초 상순(예: 10/1)일 때 직전 순은 **전달 하순** — 월 경계를 넘는 직전 순 계산 (Task 1 테스트)
- 품목에 데이터가 하나도 없을 때 요약에 그 품목이 `null` 값으로 남아 카드 자리가 유지됨 (Task 1 테스트)
- 대상이 아닌 `itemName`·`unit` 요청은 500 이 아니라 400 (Task 2 에서 `IllegalArgumentException` → 400)
- 모바일 폭(360px)에서 카드 3장이 세로로 쌓이고 차트가 가로로 넘치지 않음 (Task 3 수동 확인)
- 일별 약 420점 차트에서 x축 라벨이 겹치지 않음 (Task 3 `minTickGap`)

---

### Task 1: RetailPriceService (순 계산·요약·추이)

**Files:**
- Create: `KCSPback/src/main/java/com/agriforecast/backend/service/RetailPriceService.java`
- Modify: `KCSPback/src/main/java/com/agriforecast/backend/repository/RetailPriceRepository.java`
- Test: `KCSPback/src/test/java/com/agriforecast/backend/service/RetailPriceServiceTest.java`
- Modify: `.github/workflows/ci.yml` (테스트 한 줄)

**Interfaces:**
- Consumes: `RetailPrice`(itemName, priceDate, price, unit, marketCount), `KamisRetailService.TARGET_ITEMS`
- Produces:
  - `record Point(LocalDate date, String label, int price, int days)`
  - `record Summary(String itemName, String unit, LocalDate latestDate, Integer latestPrice, Integer prevSoonAvg, Double changePct, Object prediction)`
  - `record Series(String itemName, String unit, List<Point> points, List<Point> predictions)`
  - `List<Summary> summary()`, `Series series(String itemName, String unit)` — 잘못된 인자는 `IllegalArgumentException`
  - static: `soonStart(LocalDate)`, `soonLabel(LocalDate)`, `previousSoonStart(LocalDate)`, `soonAverages(List<RetailPrice>)`, `summarize(String, String, List<RetailPrice>)`

- [ ] **Step 1: 실패하는 테스트 작성** — `RetailPriceServiceTest`

```java
package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.RetailPrice;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 홈 서울 소매가 섹션의 순 계산·요약. 외부 의존 없음 */
class RetailPriceServiceTest {

    private static RetailPrice rp(String date, int price) {
        RetailPrice r = new RetailPrice();
        r.setItemName("양파");
        r.setPriceDate(LocalDate.parse(date));
        r.setPrice(price);
        r.setUnit("1kg");
        return r;
    }

    @Test
    void 순_판정_경계() {
        assertEquals("2026-09 상순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 10)));
        assertEquals("2026-09 중순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 11)));
        assertEquals("2026-09 중순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 20)));
        assertEquals("2026-09 하순", RetailPriceService.soonLabel(LocalDate.of(2026, 9, 21)));
        assertEquals("2026-08 하순", RetailPriceService.soonLabel(LocalDate.of(2026, 8, 31)));
        assertEquals(LocalDate.of(2026, 9, 21), RetailPriceService.soonStart(LocalDate.of(2026, 9, 30)));
    }

    @Test
    void 직전_순은_월_경계를_넘는다() {
        assertEquals(LocalDate.of(2026, 9, 21), RetailPriceService.previousSoonStart(LocalDate.of(2026, 10, 1)));
        assertEquals(LocalDate.of(2026, 10, 1), RetailPriceService.previousSoonStart(LocalDate.of(2026, 10, 15)));
        assertEquals(LocalDate.of(2025, 12, 21), RetailPriceService.previousSoonStart(LocalDate.of(2026, 1, 3)));
    }

    @Test
    void 순_평균은_조사일_단순평균_반올림() {
        List<RetailPriceService.Point> soons = RetailPriceService.soonAverages(List.of(
                rp("2026-09-01", 1000), rp("2026-09-02", 1001), rp("2026-09-11", 1200)));
        assertEquals(2, soons.size());
        assertEquals(new RetailPriceService.Point(LocalDate.of(2026, 9, 1), "2026-09 상순", 1001, 2), soons.get(0));
        assertEquals(new RetailPriceService.Point(LocalDate.of(2026, 9, 11), "2026-09 중순", 1200, 1), soons.get(1));
    }

    @Test
    void 요약은_직전_순_평균과_비교한다() {
        RetailPriceService.Summary s = RetailPriceService.summarize("양파", "1kg", List.of(
                rp("2026-09-11", 2000), rp("2026-09-15", 2000), rp("2026-09-23", 1840)));
        assertEquals(LocalDate.of(2026, 9, 23), s.latestDate());
        assertEquals(1840, s.latestPrice());
        assertEquals(2000, s.prevSoonAvg());
        assertEquals(-8.0, s.changePct());   // (1840-2000)/2000 = -8.0%
        assertNull(s.prediction());
    }

    @Test
    void 직전_순에_조사일이_없으면_증감은_null() {
        RetailPriceService.Summary s = RetailPriceService.summarize("양파", "1kg", List.of(
                rp("2026-09-02", 2000), rp("2026-09-23", 1841)));   // 중순이 비었다
        assertNull(s.prevSoonAvg());
        assertNull(s.changePct());
    }

    @Test
    void 데이터가_없는_품목도_자리를_남긴다() {
        RetailPriceService.Summary s = RetailPriceService.summarize("양배추", "1포기", List.of());
        assertEquals("양배추", s.itemName());
        assertEquals("1포기", s.unit());
        assertNull(s.latestDate());
        assertNull(s.latestPrice());
        assertNull(s.changePct());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd KCSPback && ./gradlew test --tests 'com.agriforecast.backend.service.RetailPriceServiceTest' -q`
Expected: 컴파일 실패 (`RetailPriceService` 없음)

- [ ] **Step 3: 리포지토리 메서드 추가** — `RetailPriceRepository`

```java
    List<RetailPrice> findByItemNameOrderByPriceDateAsc(String itemName);
```

- [ ] **Step 4: 서비스 구현** — `RetailPriceService.java`

```java
package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.RetailPrice;
import com.agriforecast.backend.repository.RetailPriceRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/**
 * 홈 '서울 농산물 소매가' 섹션 조회 (retail_price 읽기 전용)
 * 순: 1~10일 상순 / 11~20일 중순 / 21일~ 하순 — 예측 모델과 같은 규칙
 */
@Service
public class RetailPriceService {

    /** 조사 단위 — 데이터가 없는 품목에도 카드에 단위를 보이려고 고정해 둔다 */
    static final Map<String, String> UNITS = Map.of("양파", "1kg", "붉은고추", "100g", "양배추", "1포기");

    private final RetailPriceRepository retailPriceRepository;

    public RetailPriceService(RetailPriceRepository retailPriceRepository) {
        this.retailPriceRepository = retailPriceRepository;
    }

    public List<Summary> summary() {
        List<Summary> out = new ArrayList<>();
        for (String item : KamisRetailService.TARGET_ITEMS.keySet()) {
            out.add(summarize(item, UNITS.get(item), retailPriceRepository.findByItemNameOrderByPriceDateAsc(item)));
        }
        return out;
    }

    public Series series(String itemName, String unit) {
        if (!KamisRetailService.TARGET_ITEMS.containsKey(itemName)) {
            throw new IllegalArgumentException("소매가 대상이 아닌 품목: " + itemName);
        }
        List<RetailPrice> rows = retailPriceRepository.findByItemNameOrderByPriceDateAsc(itemName);
        List<Point> points = switch (unit) {
            case "daily" -> rows.stream()
                    .map(r -> new Point(r.getPriceDate(), r.getPriceDate().toString(), r.getPrice(), 1))
                    .toList();
            case "soon" -> soonAverages(rows);
            default -> throw new IllegalArgumentException("unit 은 daily 또는 soon: " + unit);
        };
        return new Series(itemName, UNITS.get(itemName), points, List.of());
    }

    static Summary summarize(String itemName, String unit, List<RetailPrice> rows) {
        if (rows.isEmpty()) return new Summary(itemName, unit, null, null, null, null, null);

        RetailPrice latest = rows.get(rows.size() - 1);
        LocalDate prevStart = previousSoonStart(latest.getPriceDate());
        Integer prevAvg = soonAverages(rows).stream()
                .filter(p -> p.date().equals(prevStart))
                .map(Point::price)
                .findFirst().orElse(null);
        Double changePct = prevAvg == null ? null
                : Math.round((latest.getPrice() - prevAvg) * 1000.0 / prevAvg) / 10.0;
        return new Summary(itemName, unit, latest.getPriceDate(), latest.getPrice(), prevAvg, changePct, null);
    }

    /** 날짜순 일별 → 순별 평균 (조사일이 있는 순만) */
    static List<Point> soonAverages(List<RetailPrice> rows) {
        Map<LocalDate, List<Integer>> bySoon = new TreeMap<>();
        for (RetailPrice r : rows) {
            bySoon.computeIfAbsent(soonStart(r.getPriceDate()), k -> new ArrayList<>()).add(r.getPrice());
        }
        List<Point> out = new ArrayList<>();
        bySoon.forEach((start, prices) -> {
            double avg = prices.stream().mapToInt(Integer::intValue).average().orElse(0);
            out.add(new Point(start, soonLabel(start), (int) Math.round(avg), prices.size()));
        });
        return out;
    }

    static LocalDate soonStart(LocalDate d) {
        int day = d.getDayOfMonth() <= 10 ? 1 : d.getDayOfMonth() <= 20 ? 11 : 21;
        return d.withDayOfMonth(day);
    }

    static LocalDate previousSoonStart(LocalDate d) {
        LocalDate start = soonStart(d);
        return switch (start.getDayOfMonth()) {
            case 1 -> start.minusMonths(1).withDayOfMonth(21);
            case 11 -> start.withDayOfMonth(1);
            default -> start.withDayOfMonth(11);
        };
    }

    static String soonLabel(LocalDate d) {
        int day = soonStart(d).getDayOfMonth();
        String name = day == 1 ? "상순" : day == 11 ? "중순" : "하순";
        return String.format("%d-%02d %s", d.getYear(), d.getMonthValue(), name);
    }

    public record Point(LocalDate date, String label, int price, int days) {}

    /** prediction: 소매 예측 모델이 생기면 {target, price}. 지금은 항상 null */
    public record Summary(String itemName, String unit, LocalDate latestDate, Integer latestPrice,
                          Integer prevSoonAvg, Double changePct, Object prediction) {}

    /** predictions: 순별에서만 채운다. 지금은 빈 목록 */
    public record Series(String itemName, String unit, List<Point> points, List<Point> predictions) {}
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd KCSPback && ./gradlew test --tests 'com.agriforecast.backend.service.RetailPriceServiceTest' -q`
Expected: PASS (6개)

- [ ] **Step 6: CI 목록에 추가** — `.github/workflows/ci.yml` 의 `KamisRetailParseTest` 줄 아래

```yaml
            --tests 'com.agriforecast.backend.service.RetailPriceServiceTest' \
```

- [ ] **Step 7: 커밋**

```bash
git add KCSPback/src/main/java/com/agriforecast/backend/service/RetailPriceService.java \
        KCSPback/src/main/java/com/agriforecast/backend/repository/RetailPriceRepository.java \
        KCSPback/src/test/java/com/agriforecast/backend/service/RetailPriceServiceTest.java .github/workflows/ci.yml
git commit -m "feat: 서울 소매가 순별 요약·추이 계산 추가"
```

---

### Task 2: 조회 엔드포인트

**Files:**
- Modify: `KCSPback/src/main/java/com/agriforecast/backend/controller/PriceController.java`

**Interfaces:**
- Consumes: `RetailPriceService.summary()`, `RetailPriceService.series(String, String)`
- Produces: `GET /api/price/retail/summary` → `List<Summary>` / `GET /api/price/retail/series?itemName=&unit=daily|soon` → `Series`, 잘못된 인자 400 `{ "message": ... }`

- [ ] **Step 1: 필드·엔드포인트 추가** — 기존 `@Autowired` 필드 스타일을 따른다

```java
    @Autowired
    private RetailPriceService retailPriceService;

    // 홈 '서울 농산물 소매가' 카드 (KAMIS 서울 평균, 상품)
    @GetMapping("/retail/summary")
    public ResponseEntity<List<RetailPriceService.Summary>> getRetailSummary() {
        return ResponseEntity.ok(retailPriceService.summary());
    }

    // 홈 소매가 추이 차트. unit=daily|soon, 예측은 soon 에만 붙는다
    @GetMapping("/retail/series")
    public ResponseEntity<?> getRetailSeries(@RequestParam String itemName,
                                             @RequestParam(defaultValue = "soon") String unit) {
        try {
            return ResponseEntity.ok(retailPriceService.series(itemName, unit));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
```

import 추가: `com.agriforecast.backend.service.RetailPriceService` (같은 패키지 와일드카드가 없으면)

- [ ] **Step 2: 컴파일 + CI 백엔드 테스트 전체**

Run: `cd KCSPback && ./gradlew compileJava test $(grep -o "\-\-tests '[^']*'" ../.github/workflows/ci.yml | tr '\n' ' ') -q`
Expected: 모두 PASS

- [ ] **Step 3: 커밋**

```bash
git add KCSPback/src/main/java/com/agriforecast/backend/controller/PriceController.java
git commit -m "feat: 서울 소매가 요약·추이 조회 API 추가"
```

---

### Task 3: 홈 화면 섹션

**Files:**
- Create: `KCSPfront/src/components/RetailPriceSection.jsx`
- Modify: `KCSPfront/src/api/api.js` (조회 함수 2개)
- Modify: `KCSPfront/src/pages/Home.jsx` (모델 설명 섹션·상수 제거 후 섹션 삽입)
- Modify: `PROGRESS.md` (4.3 진행, 4.4 에 걷어낸 모델 설명 후속 작업)

**Interfaces:**
- Consumes: Task 2 의 두 API 응답 모양 (spec 그대로)
- Produces: `api.getRetailSummary()`, `api.getRetailSeries(itemName, unit)`, `<RetailPriceSection />`

- [ ] **Step 1: api.js 에 추가** (`getDailyPrices` 아래)

```js
  // KAMIS 서울 소매가 요약 (홈 카드)
  getRetailSummary: async () => {
    const response = await fetch(`${API_BASE_URL}/price/retail/summary`);
    if (!response.ok) throw new Error('소매가 데이터를 불러오는데 실패했습니다.');
    return await response.json();
  },

  // KAMIS 서울 소매가 추이 (unit: 'daily' | 'soon')
  getRetailSeries: async (itemName, unit) => {
    const response = await fetch(
      `${API_BASE_URL}/price/retail/series?itemName=${encodeURIComponent(itemName)}&unit=${unit}`
    );
    if (!response.ok) throw new Error('소매가 추이를 불러오는데 실패했습니다.');
    return await response.json();
  },
```

- [ ] **Step 2: RetailPriceSection.jsx 작성**

```jsx
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/api';
import StatusMessage from './StatusMessage';

const COLOR_ACTUAL = '#4A90E2';
const COLOR_PRED = '#F59E0B';

const won = (v) => (v == null ? '-' : `${v.toLocaleString()}원`);

// "2026-09-23" → "9/23"
const shortDate = (iso) => {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
};

// "202610상순" → "10월 상순"
const targetLabel = (code) => (code ? `${Number(code.slice(4, 6))}월 ${code.slice(6)}` : '');

function ChangeText({ pct }) {
  if (pct == null) return <span className="text-subtext-light">지난 순 평균 대비 -</span>;
  const color = pct > 0 ? 'text-price-up' : pct < 0 ? 'text-price-down' : 'text-text-main';
  const mark = pct > 0 ? '▲' : pct < 0 ? '▼' : '―';
  return (
    <span className="text-subtext-light">
      지난 순 평균 대비 <span className={`font-semibold ${color}`}>{mark} {Math.abs(pct)}%</span>
    </span>
  );
}

function ItemCard({ item, selected, onSelect }) {
  const empty = item.latestPrice == null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl p-4 bg-white border transition ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 hover:border-primary/50'
      }`}
    >
      <p className="text-sm font-semibold text-text-main">
        {item.itemName} <span className="text-xs font-normal text-subtext-light">{item.unit}</span>
      </p>
      {empty ? (
        <p className="text-lg font-bold text-subtext-light mt-2">데이터 없음</p>
      ) : (
        <>
          <p className="text-2xl font-bold text-text-main mt-1">{won(item.latestPrice)}</p>
          <p className="text-xs mt-1"><ChangeText pct={item.changePct} /></p>
          <p className="text-xs text-subtext-light mt-0.5">{shortDate(item.latestDate)} 조사</p>
        </>
      )}
      <p className="text-xs text-subtext-light mt-3 pt-2 border-t border-gray-100">
        {item.prediction
          ? <>다음 순({targetLabel(item.prediction.target)}) 예측 <span className="font-semibold" style={{ color: COLOR_PRED }}>{won(item.prediction.price)}</span></>
          : '다음 순 예측 · 준비 중'}
      </p>
    </button>
  );
}

function SeriesTooltip({ active, payload, unit, isSoon }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow px-3 py-2 text-xs">
      <p className="font-semibold text-text-main mb-1">{p.label}</p>
      {p.price != null && <p className="text-text-main"><span style={{ color: COLOR_ACTUAL }}>●</span> {won(p.price)} / {unit}</p>}
      {p.predicted != null && !p.bridge && <p className="text-text-main"><span style={{ color: COLOR_PRED }}>●</span> 예측 {won(p.predicted)}</p>}
      {isSoon && p.days != null && <p className="text-subtext-light mt-1">조사 {p.days}일</p>}
    </div>
  );
}

export default function RetailPriceSection() {
  const [summary, setSummary] = useState({ status: 'loading', data: [] });
  const [selected, setSelected] = useState(null);
  const [unit, setUnit] = useState('soon');
  const [series, setSeries] = useState({ status: 'loading', data: null });

  useEffect(() => {
    api.getRetailSummary()
      .then((data) => {
        setSummary({ status: 'ready', data });
        if (data.length > 0) setSelected(data[0].itemName);
      })
      .catch(() => setSummary({ status: 'error', data: [] }));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setSeries({ status: 'loading', data: null });
    api.getRetailSeries(selected, unit)
      .then((data) => { if (!cancelled) setSeries({ status: 'ready', data }); })
      .catch(() => { if (!cancelled) setSeries({ status: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [selected, unit]);

  const isSoon = unit === 'soon';
  const predictions = isSoon ? (series.data?.predictions ?? []) : [];

  // 실제값 점 + (순별이면) 예측 점. 마지막 실제 점을 예측선 시작점으로 잇는다
  const chartData = useMemo(() => {
    const points = (series.data?.points ?? []).map((p) => ({ label: p.label, price: p.price, days: p.days }));
    if (predictions.length === 0 || points.length === 0) return points;
    const last = points[points.length - 1];
    last.predicted = last.price;
    last.bridge = true;
    return [...points, ...predictions.map((p) => ({ label: p.label, predicted: p.price }))];
  }, [series.data, predictions]);

  const unitLabel = series.data?.unit ?? '';

  return (
    <section>
      <div className="pb-3 pt-5">
        <h2 className="text-text-main text-[22px] font-bold leading-tight">서울 농산물 소매가</h2>
        <p className="text-xs text-subtext-light mt-1">KAMIS Open API · 서울 평균 · 상품 등급 · 매일 갱신</p>
      </div>

      {summary.status === 'loading' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-xl bg-background-light animate-pulse" />)}
        </div>
      ) : summary.status === 'error' ? (
        <StatusMessage status="error" errorText="소매가 데이터를 불러오지 못했습니다." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {summary.data.map((item) => (
              <ItemCard
                key={item.itemName}
                item={item}
                selected={item.itemName === selected}
                onSelect={() => setSelected(item.itemName)}
              />
            ))}
          </div>

          <div className="rounded-xl p-4 sm:p-5 bg-white border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-text-main">{selected} 소매가 추이</h3>
              <div className="flex items-center gap-3">
                {isSoon && predictions.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-subtext-light">
                    <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={COLOR_PRED} strokeWidth="2" strokeDasharray="4 3" /></svg>
                    예측
                  </span>
                )}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  {[['daily', '일별'], ['soon', '순별']].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUnit(key)}
                      className={`px-3 py-1 ${unit === key ? 'bg-primary text-white' : 'bg-white text-text-main hover:bg-background-light'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {series.status === 'loading' ? (
              <div className="h-64 rounded-lg bg-background-light animate-pulse" />
            ) : series.status === 'error' ? (
              <StatusMessage status="error" errorText="소매가 추이를 불러오지 못했습니다." />
            ) : chartData.length === 0 ? (
              <StatusMessage status="ready" emptyText="아직 수집된 소매가가 없습니다." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={(l) => (isSoon ? l.slice(2) : shortDate(l))}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    minTickGap={24}
                  />
                  <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11, fill: '#64748B' }} width={56} domain={['auto', 'auto']} />
                  <Tooltip content={<SeriesTooltip unit={unitLabel} isSoon={isSoon} />} />
                  <Line type="monotone" dataKey="price" stroke={COLOR_ACTUAL} strokeWidth={2}
                        dot={isSoon ? { r: 2.5, fill: COLOR_ACTUAL } : false} activeDot={{ r: 4 }} connectNulls={false} />
                  {predictions.length > 0 && (
                    <Line type="monotone" dataKey="predicted" stroke={COLOR_PRED} strokeWidth={2}
                          strokeDasharray="5 4" dot={false} connectNulls={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Home.jsx 정리**
  - 상수 `DATA_SOURCES`·`PIPELINE_STEPS`·`MODEL_FEATURES`·`KEY_VARIABLES` 삭제 (주석 `// 품목별 사용 데이터는 ...` 포함)
  - `<section>` "AI 농산물 가격 예측 모델" 전체를 `<RetailPriceSection />` 로 교체
  - `import RetailPriceSection from '../components/RetailPriceSection';` 추가

- [ ] **Step 4: PROGRESS.md**
  - 4.3 할 일 "홈 섹션 UI" 에 "서울 소매가 섹션(이 PR) — 예측 칸은 모델 후" 반영
  - 4.4 에 `- [ ] 홈에서 걷어낸 농넷 도매 모델 설명(파이프라인·데이터 소스·모델 특징)의 새 자리 — 문서로 정리할지 페이지로 만들지 결정`
  - 3절 진행 중 표: 양배추 백필 완료로 정리, 이 PR 추가

- [ ] **Step 5: 빌드**

Run: `cd KCSPfront && npm run build`
Expected: `✓ built`

- [ ] **Step 6: 화면 확인** — 백엔드 없이 운영 API 에 붙여 본다

Run: `cd KCSPfront && npx vite --port 5174` 을 운영 API 프록시로 띄울 수 있으면 데스크톱·360px 폭 확인. 안 되면 배포 후 운영에서 확인
Expected: 카드 3장·출처 문구·일별/순별 토글, 360px 에서 카드 세로 쌓임·가로 스크롤 없음

- [ ] **Step 7: 커밋**

```bash
git add KCSPfront/src/components/RetailPriceSection.jsx KCSPfront/src/api/api.js KCSPfront/src/pages/Home.jsx PROGRESS.md
git commit -m "feat: 홈 모델 설명을 서울 소매가 섹션으로 교체"
```
