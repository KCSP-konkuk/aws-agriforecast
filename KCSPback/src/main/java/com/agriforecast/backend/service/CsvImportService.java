package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.AgriPrice;
import com.agriforecast.backend.repository.AgriPriceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.FileReader;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class CsvImportService {
    private static final Logger logger = LoggerFactory.getLogger(CsvImportService.class);
    private final AgriPriceRepository agriPriceRepository;

    public CsvImportService(AgriPriceRepository agriPriceRepository) {
        this.agriPriceRepository = agriPriceRepository;
    }

    /**
     * 로컬 CSV 파일 경로를 받아 DB에 삽입합니다.
     */
    public int importAgriPriceCsv(String filePath) {
        int savedCount = 0;
        try (BufferedReader br = new BufferedReader(new FileReader(filePath))) {
            String line;
            boolean isFirstLine = true;
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            List<AgriPrice> batch = new ArrayList<>();

            while ((line = br.readLine()) != null) {
                if (isFirstLine) { // 첫 줄(헤더) 무시
                    isFirstLine = false;
                    continue;
                }

                // DATE,품목명,단위,등급명,평균가격,전일,전년
                // 예: 2026-03-22,양파,1키로,상,0,754,1768
                String[] columns = line.split(",");
                if (columns.length < 5) continue;

                String dateStr = columns[0].trim();
                String itemName = columns[1].trim();
                String grade = columns[3].trim();
                String priceStr = columns[4].trim();

                // 등급: "상" 등급만 저장 (원하시는 대로 수정 가능)
                if (!"상".equals(grade)) continue;

                double avgPrice;
                try {
                    avgPrice = Double.parseDouble(priceStr);
                } catch (NumberFormatException e) {
                    continue;
                }

                // 가격이 0인 경우라도 나중에 순별 변환을 위해 그대로 저장합니다.
                // if (avgPrice < 0) continue; 

                // 날짜 파싱 -> year, month, day 분리 작성
                LocalDate date = LocalDate.parse(dateStr, formatter);
                int year = date.getYear();
                int month = date.getMonthValue();
                int day = date.getDayOfMonth();

                // 이미 해당 날짜의 품목이 존재하는지 체크
                if (agriPriceRepository.findByItemNameAndYearAndMonthAndDay(itemName, year, month, day).isPresent()) {
                    continue;
                }

                AgriPrice entity = new AgriPrice();
                entity.setItemName(itemName);
                entity.setYear(year);
                entity.setMonth(month);
                entity.setDay(day);
                entity.setAvgPrice(avgPrice);

                batch.add(entity);

                // JPA 처리 효율을 위해 500개씩 나눠서 일괄 저장(Batch Save)
                if (batch.size() >= 500) {
                    agriPriceRepository.saveAll(batch);
                    savedCount += batch.size();
                    batch.clear();
                }
            }

            // 남은 리스트 마저 저장
            if (!batch.isEmpty()) {
                agriPriceRepository.saveAll(batch);
                savedCount += batch.size();
            }

            logger.info("✅ CSV 임포트 성공: {} -> 총 {}건 저장!", filePath, savedCount);

        } catch (Exception e) {
            logger.error("❌ CSV 임포트 실패: {}", e.getMessage());
            throw new RuntimeException("CSV 파일 처리 중 오류 발생", e);
        }

        return savedCount;
    }
}
