package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.SupplyData;
import com.agriforecast.backend.repository.SupplyDataRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 가락시장 공공데이터 반입물량(정산후) 수집 서비스
 */
@Service
public class SupplyCollectService {

    private static final Logger logger = LoggerFactory.getLogger(SupplyCollectService.class);
    private static final String API_URL =
            "http://www.garak.co.kr/homepage/publicdata/dataJsonOpen.do" +
                    "?id={id}&passwd={passwd}&dataid=data22&pagesize=200&pageidx=1&portal.templet=false&date={date}";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Set<String> TARGET_ITEMS = new LinkedHashSet<>();

    static {
        TARGET_ITEMS.add("배추");
        TARGET_ITEMS.add("양파");
        TARGET_ITEMS.add("양배추");
        TARGET_ITEMS.add("당근");
    }

    @Value("${garak.public-data.id}")
    private String publicDataId;

    @Value("${garak.public-data.password}")
    private String publicDataPassword;

    private final SupplyDataRepository supplyDataRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public SupplyCollectService(SupplyDataRepository supplyDataRepository,
                                RestTemplate restTemplate,
                                ObjectMapper objectMapper) {
        this.supplyDataRepository = supplyDataRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public int collectByYearMonth(int year, int month) {
        YearMonth ym = YearMonth.of(year, month);
        return collectByDateRange(LocalDate.of(year, month, 1), ym.atEndOfMonth());
    }

    public int collectByDateRange(LocalDate startDate, LocalDate endDate) {
        int savedCount = 0;

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            savedCount += collectByDate(date);
        }

        logger.info("반입량 저장 완료 - {} ~ {}, {}건", startDate, endDate, savedCount);
        return savedCount;
    }

    public int collectByDate(LocalDate date) {
        int savedCount = 0;

        try {
            String body = restTemplate.getForObject(
                    API_URL,
                    String.class,
                    publicDataId,
                    publicDataPassword,
                    date.format(DATE_FMT)
            );

            if (body == null || body.isBlank()) {
                logger.warn("반입량 API 응답 없음 - {}", date);
                return 0;
            }

            JsonNode resultData = objectMapper.readTree(body).path("resultData");
            if (!resultData.isArray()) {
                logger.warn("반입량 API resultData 형식 오류 - {}", date);
                return 0;
            }

            for (JsonNode row : resultData) {
                String itemName = row.path("PUM_NM").asText("");
                if (!TARGET_ITEMS.contains(itemName)) {
                    continue;
                }

                if (supplyDataRepository.findByItemNameAndYearAndMonthAndDay(
                        itemName, date.getYear(), date.getMonthValue(), date.getDayOfMonth()).isPresent()) {
                    continue;
                }

                JsonNode sumTotNode = row.path("SUM_TOT");
                if (sumTotNode.isMissingNode() || sumTotNode.isNull()) {
                    continue;
                }

                SupplyData entity = new SupplyData();
                entity.setItemName(itemName);
                entity.setYear(date.getYear());
                entity.setMonth(date.getMonthValue());
                entity.setDay(date.getDayOfMonth());
                entity.setTotalSupply(sumTotNode.asDouble());
                supplyDataRepository.saveAndFlush(entity);
                savedCount++;
            }

            if (savedCount == 0) {
                logger.info("반입량 저장 대상 없음 - {}", date);
            } else {
                logger.info("반입량 일별 저장 완료 - {}, {}건", date, savedCount);
            }
        } catch (Exception e) {
            logger.warn("반입량 API 호출/저장 실패 - {}: {}", date, e.getMessage());
        }

        return savedCount;
    }
}
