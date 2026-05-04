package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.StationWeatherData;
import com.agriforecast.backend.repository.StationWeatherDataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * weather_2018to2025.csv 파일을 읽어 station_weather_data 테이블에 일괄 적재
 *
 * CSV 컬럼 순서:
 *  0:지역코드  1:지역명  2:날짜  3:평균기온  4:최저기온  5:최고기온
 *  6:강수량  7:평균습도  8:일조시간  9:일사량
 *  10:전년_평균기온  11:전년_강수량  12:전년_일조시간  13:전년_일사량  14:전년_평균습도
 */
@Service
public class CsvWeatherImportService {

    private static final Logger logger = LoggerFactory.getLogger(CsvWeatherImportService.class);
    private static final String CSV_PATH = "data/weather_2018to2025.csv";
    private static final int BATCH_SIZE = 500;

    private final StationWeatherDataRepository repository;

    public CsvWeatherImportService(StationWeatherDataRepository repository) {
        this.repository = repository;
    }

    /**
     * CSV 파일을 읽어 DB에 일괄 적재. 이미 존재하는 날짜+지점은 스킵.
     *
     * @return 새로 저장된 레코드 수
     */
    @Transactional
    public int importFromCsv() {
        // 기존에 저장된 날짜_지점 키를 Set으로 로드 (중복 체크용)
        Set<String> existingKeys = new HashSet<>(repository.findAllDateStationKeys());
        logger.info("CSV 적재 시작 - 기존 레코드 {}건", existingKeys.size());

        List<StationWeatherData> batch = new ArrayList<>(BATCH_SIZE);
        int totalSaved = 0;
        int lineNumber = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        new ClassPathResource(CSV_PATH).getInputStream(),
                        StandardCharsets.UTF_8))) {

            String line;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (lineNumber == 1) continue; // 헤더 스킵

                StationWeatherData entity = parseLine(line);
                if (entity == null) continue;

                String key = entity.getObservationDate() + "_" + entity.getStationCode();
                if (existingKeys.contains(key)) continue;

                batch.add(entity);
                existingKeys.add(key); // 같은 CSV 내 중복 방지

                if (batch.size() >= BATCH_SIZE) {
                    repository.saveAll(batch);
                    totalSaved += batch.size();
                    batch.clear();
                    logger.debug("CSV 적재 중 - 누적 {}건 저장", totalSaved);
                }
            }

            if (!batch.isEmpty()) {
                repository.saveAll(batch);
                totalSaved += batch.size();
            }

        } catch (Exception e) {
            logger.error("CSV 파일 읽기 실패: {}", e.getMessage(), e);
            throw new RuntimeException("CSV 기상 데이터 적재 실패", e);
        }

        logger.info("CSV 적재 완료 - 신규 {}건 저장 (전체 {} 라인 처리)", totalSaved, lineNumber - 1);
        return totalSaved;
    }

    private StationWeatherData parseLine(String line) {
        if (line == null || line.isBlank()) return null;

        String[] cols = line.split(",", -1);
        if (cols.length < 15) return null;

        try {
            StationWeatherData entity = new StationWeatherData();
            entity.setStationCode(Integer.parseInt(cols[0].trim()));
            entity.setObservationDate(LocalDate.parse(cols[2].trim()));
            entity.setAvgTemp(parseDouble(cols[3]));
            entity.setMinTemp(parseDouble(cols[4]));
            entity.setMaxTemp(parseDouble(cols[5]));
            entity.setRainfall(parseDouble(cols[6]));
            entity.setAvgHumidity(parseDouble(cols[7]));
            entity.setSunshineDuration(parseDouble(cols[8]));
            entity.setSolarRadiation(parseDouble(cols[9]));
            entity.setPrevYearTemp(parseDouble(cols[10]));
            entity.setPrevYearRainfall(parseDouble(cols[11]));
            entity.setPrevYearSunshine(parseDouble(cols[12]));
            entity.setPrevYearSolar(parseDouble(cols[13]));
            entity.setPrevYearHumidity(parseDouble(cols[14]));
            return entity;
        } catch (Exception e) {
            logger.debug("CSV 파싱 스킵 (라인: {}): {}", line, e.getMessage());
            return null;
        }
    }

    private Double parseDouble(String val) {
        if (val == null) return null;
        val = val.trim();
        if (val.isEmpty()) return null;
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}