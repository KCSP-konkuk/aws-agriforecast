package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.OilPrice;
import com.agriforecast.backend.repository.OilPriceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * oil_2018to20260501.csv 파일을 읽어 oil_price 테이블에 자동차용경유 과거 데이터를 적재
 */
@Service
public class OilPriceCsvImportService {

    private static final Logger logger = LoggerFactory.getLogger(OilPriceCsvImportService.class);
    private static final String CSV_PATH = "data/oil_2018to20260501.csv";
    private static final String PRODUCT_NAME = "자동차용경유";
    private static final Charset CSV_CHARSET = Charset.forName("MS949");
    private static final DateTimeFormatter CSV_DATE_FMT = DateTimeFormatter.ofPattern("yyyy년MM월dd일");
    private static final int BATCH_SIZE = 500;

    private final OilPriceRepository oilPriceRepository;

    public OilPriceCsvImportService(OilPriceRepository oilPriceRepository) {
        this.oilPriceRepository = oilPriceRepository;
    }

    @Transactional
    public int importFromCsv() {
        Set<String> existingKeys = new HashSet<>(oilPriceRepository.findAllDateProductKeys());
        logger.info("유가 CSV 적재 시작 - 기존 레코드 {}건", existingKeys.size());

        List<OilPrice> batch = new ArrayList<>(BATCH_SIZE);
        int totalSaved = 0;
        int lineNumber = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        new ClassPathResource(CSV_PATH).getInputStream(),
                        CSV_CHARSET))) {

            String line;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (lineNumber == 1) continue;

                OilPrice entity = parseLine(line);
                if (entity == null) continue;

                String key = entity.getPriceDate() + "_" + entity.getProductName();
                if (existingKeys.contains(key)) continue;

                batch.add(entity);
                existingKeys.add(key);

                if (batch.size() >= BATCH_SIZE) {
                    oilPriceRepository.saveAll(batch);
                    totalSaved += batch.size();
                    batch.clear();
                    logger.debug("유가 CSV 적재 중 - 누적 {}건 저장", totalSaved);
                }
            }

            if (!batch.isEmpty()) {
                oilPriceRepository.saveAll(batch);
                totalSaved += batch.size();
            }
        } catch (Exception e) {
            logger.error("유가 CSV 파일 읽기 실패: {}", e.getMessage(), e);
            throw new RuntimeException("유가 CSV 데이터 적재 실패", e);
        }

        logger.info("유가 CSV 적재 완료 - 신규 {}건 저장 (전체 {} 라인 처리)", totalSaved, lineNumber - 1);
        return totalSaved;
    }

    private OilPrice parseLine(String line) {
        if (line == null || line.isBlank()) return null;

        String[] cols = line.split(",", -1);
        if (cols.length < 2) return null;

        try {
            OilPrice entity = new OilPrice();
            entity.setPriceDate(LocalDate.parse(cols[0].trim(), CSV_DATE_FMT));
            entity.setProductName(PRODUCT_NAME);
            entity.setAvgPrice(Double.parseDouble(cols[1].trim()));
            return entity;
        } catch (Exception e) {
            logger.debug("유가 CSV 파싱 스킵 (라인: {}): {}", line, e.getMessage());
            return null;
        }
    }
}
