package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.SupplyData;
import com.agriforecast.backend.repository.SupplyDataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class SupplyCsvImportService {

    private static final Logger logger = LoggerFactory.getLogger(SupplyCsvImportService.class);
    private static final List<Path> CSV_PATHS = List.of(
            Path.of("src", "test", "java", "file_1_Sheet1.csv"),
            Path.of("src", "test", "java", "file_2_Sheet1.csv"),
            Path.of("src", "test", "java", "file_3_Sheet1.csv"),
            Path.of("src", "test", "java", "file_4_Sheet1.csv")
    );

    private final SupplyDataRepository supplyDataRepository;

    public SupplyCsvImportService(SupplyDataRepository supplyDataRepository) {
        this.supplyDataRepository = supplyDataRepository;
    }

    public int importFromCsv() {
        int totalSaved = 0;
        for (Path csvPath : CSV_PATHS) {
            totalSaved += importSingleCsv(csvPath);
        }
        logger.info("반입량 CSV 적재 완료 - 총 {}건", totalSaved);
        return totalSaved;
    }

    private int importSingleCsv(Path csvPath) {
        if (!Files.exists(csvPath)) {
            logger.warn("반입량 CSV 파일 없음 - {}", csvPath);
            return 0;
        }

        int savedCount = 0;
        List<SupplyData> batch = new ArrayList<>();

        try (BufferedReader reader = Files.newBufferedReader(csvPath, StandardCharsets.UTF_8)) {
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (firstLine) {
                    firstLine = false;
                    continue;
                }

                String[] columns = line.split(",");
                if (columns.length < 3) {
                    continue;
                }

                LocalDate date = LocalDate.parse(columns[0].trim());
                String itemName = columns[1].trim();

                if (supplyDataRepository.findByItemNameAndYearAndMonthAndDay(
                        itemName, date.getYear(), date.getMonthValue(), date.getDayOfMonth()).isPresent()) {
                    continue;
                }

                double totalSupply;
                try {
                    totalSupply = Double.parseDouble(columns[2].trim());
                } catch (NumberFormatException e) {
                    continue;
                }

                SupplyData entity = new SupplyData();
                entity.setItemName(itemName);
                entity.setYear(date.getYear());
                entity.setMonth(date.getMonthValue());
                entity.setDay(date.getDayOfMonth());
                entity.setTotalSupply(totalSupply);
                batch.add(entity);

                if (batch.size() >= 500) {
                    supplyDataRepository.saveAll(batch);
                    savedCount += batch.size();
                    batch.clear();
                }
            }

            if (!batch.isEmpty()) {
                supplyDataRepository.saveAll(batch);
                savedCount += batch.size();
            }

            logger.info("반입량 CSV 적재 완료 - {}: {}건", csvPath, savedCount);
            return savedCount;
        } catch (Exception e) {
            logger.error("반입량 CSV 적재 실패 - {}: {}", csvPath, e.getMessage());
            throw new RuntimeException("반입량 CSV 파일 처리 중 오류 발생", e);
        }
    }
}
