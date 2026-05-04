package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.StationWeatherData;
import com.agriforecast.backend.repository.StationWeatherDataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Set;

/**
 * 기상청 ASOS 지점별 일별 날씨 데이터 수집
 * API: https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd.php
 *
 * 한 번의 호출로 12개 지점 데이터 동시 수집 (stn= 콜론 구분)
 * 전년값은 DB 내 전년 동기 레코드를 참조하여 추가 API 호출 없이 저장
 *
 * 응답 컬럼 순서 (공백 구분, 실제 응답 기준):
 *  0:TM  1:STN  2:WS_AVG  3:WR_DAY  4:WD_MAX  5:WS_MAX  6:WS_MAX_TM
 *  7:WD_INS  8:WS_INS  9:WS_INS_TM  10:TA_AVG  11:TA_MAX  12:TA_MAX_TM
 *  13:TA_MIN  14:TA_MIN_TM  15:TD_AVG  16:TS_AVG  17:TG_MIN  18:HM_AVG
 *  19:HM_MIN  20:HM_MIN_TM  21:PV_AVG  22:EV_S  23:EV_L  24:FG_DUR
 *  25:PA_AVG  26:PS_AVG  27:PS_MAX  28:PS_MAX_TM  29:PS_MIN  30:PS_MIN_TM
 *  31:CA_TOT  32:SS_DAY  33:SS_DUR  34:SS_CMB  35:SI_DAY  36:SI_60M_MAX
 *  37:SI_60M_MAX_TM  38:RN_DAY  ...
 */
@Service
public class StationWeatherCollectService {

    private static final Logger logger = LoggerFactory.getLogger(StationWeatherCollectService.class);

    private static final String BASE_URL = "https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd.php";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    // 대상 지점: 무안(165), 창녕(264), 함양(247), 제주(184), 평창(100),
    //           구좌(188), 밀양(288), 태백(216), 해남(261), 괴산(226), 홍성(177)
    private static final String STATION_PARAM = "165:264:247:184:100:188:288:216:261:226:177";
    private static final Set<Integer> TARGET_STATIONS =
            Set.of(165, 264, 247, 184, 100, 188, 288, 216, 261, 226, 177);

    private static final int IDX_STN    = 1;
    private static final int IDX_TA_AVG = 10;
    private static final int IDX_TA_MAX = 11;
    private static final int IDX_TA_MIN = 13;
    private static final int IDX_HM_AVG = 18;
    private static final int IDX_SS_DAY = 32;
    private static final int IDX_SI_DAY = 35;
    private static final int IDX_RN_DAY = 38;
    private static final int MIN_COLS   = 39;

    @Value("${weather.auth-key}")
    private String authKey;

    private final StationWeatherDataRepository repository;
    private final RestTemplate restTemplate = new RestTemplate();

    // self-injection: collectByDateRange → collectByDate 호출 시 @Transactional 프록시 적용
    @Lazy
    @Autowired
    private StationWeatherCollectService self;

    public StationWeatherCollectService(StationWeatherDataRepository repository) {
        this.repository = repository;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * 특정 연월 수집
     */
    public int collectByYearMonth(int year, int month) {
        YearMonth ym = YearMonth.of(year, month);
        return collectByDateRange(
                LocalDate.of(year, month, 1),
                LocalDate.of(year, month, ym.lengthOfMonth()));
    }

    /**
     * 날짜 범위 수집 (일별 API 호출, 100ms 간격)
     * 이미 저장된 날짜+지점은 스킵
     */
    public int collectByDateRange(LocalDate startDate, LocalDate endDate) {
        int totalSaved = 0;
        LocalDate current = startDate;

        while (!current.isAfter(endDate)) {
            try {
                totalSaved += self.collectByDate(current);
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.warn("지점별 기상 수집 인터럽트 - 마지막 날짜: {}", current);
                break;
            } catch (Exception e) {
                logger.error("날씨 수집 실패 - {}: {}", current, e.getMessage());
            }
            current = current.plusDays(1);
        }

        logger.info("지점별 기상 수집 완료 - {} ~ {}, 총 {}건", startDate, endDate, totalSaved);
        return totalSaved;
    }

    /**
     * 특정 날짜 - 12개 지점 한 번에 수집 (날짜별 즉시 커밋)
     */
    @Transactional
    public int collectByDate(LocalDate date) {
        String rawData = fetchData(date.format(DATE_FMT));
        if (rawData == null || rawData.isBlank()) {
            logger.warn("기상청 응답 없음 - {}", date);
            return 0;
        }

        int savedCount = 0;
        for (String line : rawData.split("\n")) {
            line = line.trim();
            if (line.startsWith("#") || line.isEmpty()) continue;

            String[] cols = line.split("\\s+");
            if (cols.length < MIN_COLS) continue;

            try {
                int stationCode = Integer.parseInt(cols[IDX_STN].trim());
                if (!TARGET_STATIONS.contains(stationCode)) continue;
                if (repository.existsByObservationDateAndStationCode(date, stationCode)) continue;

                StationWeatherData entity = new StationWeatherData();
                entity.setObservationDate(date);
                entity.setStationCode(stationCode);
                entity.setAvgTemp(parseDouble(cols[IDX_TA_AVG]));
                entity.setMaxTemp(parseDouble(cols[IDX_TA_MAX]));
                entity.setMinTemp(parseDouble(cols[IDX_TA_MIN]));
                entity.setRainfall(parseDouble(cols[IDX_RN_DAY]));
                entity.setSunshineDuration(parseDouble(cols[IDX_SS_DAY]));
                entity.setSolarRadiation(parseDouble(cols[IDX_SI_DAY]));
                entity.setAvgHumidity(parseDouble(cols[IDX_HM_AVG]));

                fillPrevYearData(entity, date, stationCode);

                repository.save(entity);
                savedCount++;
            } catch (Exception e) {
                logger.debug("기상 데이터 파싱 skip: {}", line);
            }
        }

        return savedCount;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** 저장 시점에 DB 내 전년 동기 레코드를 참조해 prevYear 필드 채우기 */
    private void fillPrevYearData(StationWeatherData entity, LocalDate date, int stationCode) {
        repository.findByObservationDateAndStationCode(date.minusYears(1), stationCode)
                .ifPresent(prev -> {
                    entity.setPrevYearTemp(prev.getAvgTemp());
                    entity.setPrevYearRainfall(prev.getRainfall());
                    entity.setPrevYearSunshine(prev.getSunshineDuration());
                    entity.setPrevYearSolar(prev.getSolarRadiation());
                    entity.setPrevYearHumidity(prev.getAvgHumidity());
                });
    }

    private String fetchData(String tm) {
        try {
            String url = BASE_URL
                    + "?tm=" + tm
                    + "&stn=" + STATION_PARAM
                    + "&disp=0"
                    + "&help=0"
                    + "&authKey=" + authKey;
            return restTemplate.getForObject(url, String.class);
        } catch (Exception e) {
            logger.error("기상청 API 호출 실패 ({}): {}", tm, e.getMessage());
            return null;
        }
    }

    private Double parseDouble(String val) {
        if (val == null) return null;
        val = val.trim();
        if (val.isEmpty() || val.equals("null")) return null;
        try {
            double d = Double.parseDouble(val);
            // 기상청 결측값: -9, -99, -999 (소수점 포함 형태도 처리)
            if (d == -9.0 || d == -99.0 || d == -999.0) return null;
            return d;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
