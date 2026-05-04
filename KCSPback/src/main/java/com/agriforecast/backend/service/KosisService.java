package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.CpiData;
import com.agriforecast.backend.entity.PpiData;
import com.agriforecast.backend.repository.CpiDataRepository;
import com.agriforecast.backend.repository.PpiDataRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * KOSIS API → CpiData, PpiData DB 저장
 * CPI: 소비자물가지수 품목별 (배추, 양배추, 양파)
 * PPI: 생산자물가지수 품목별 (배추, 양배추, 양파)
 */
@Service
@Transactional
public class KosisService {

    private static final Logger logger = LoggerFactory.getLogger(KosisService.class);
    private static final String BASE_URL = "https://kosis.kr/openapi/Param/statisticsParameterData.do";

    @Value("${kosis.api-key}")
    private String apiKey;

    @Value("${kosis.cpi.org-id}")
    private String cpiOrgId;

    @Value("${kosis.cpi.tbl-id}")
    private String cpiTblId;

    @Value("${kosis.cpi.itm-id}")
    private String cpiItmId;

    @Value("${kosis.cpi.obj-l1}")
    private String cpiObjL1;

    @Value("${kosis.ppi.org-id}")
    private String ppiOrgId;

    @Value("${kosis.ppi.tbl-id}")
    private String ppiTblId;

    @Value("${kosis.ppi.itm-id}")
    private String ppiItmId;

    private final CpiDataRepository cpiDataRepository;
    private final PpiDataRepository ppiDataRepository;
    private final RestTemplate restTemplate;

    public KosisService(CpiDataRepository cpiDataRepository, PpiDataRepository ppiDataRepository,
                        RestTemplate restTemplate) {
        this.cpiDataRepository = cpiDataRepository;
        this.ppiDataRepository = ppiDataRepository;
        this.restTemplate = restTemplate;
    }

    // CPI 품목 코드: objL2 사용 (DT_1J22112 테이블)
    private static final Map<String, String> CPI_ITEM_CODES = Map.of(
            "배추",  "A02A01701",
            "양배추", "A02A01704",
            "양파",  "A02A01722"
    );

    /**
     * 연도 범위로 CPI 수집 및 저장 (배추, 양배추, 양파)
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public int collectCpi(int startYear, int endYear) {
        String startPrd = startYear + "01";
        String endPrd = endYear + "12";

        int savedCount = 0;
        for (Map.Entry<String, String> entry : CPI_ITEM_CODES.entrySet()) {
            String itemName = entry.getKey();
            String objL2 = entry.getValue();

            List<Map<String, Object>> items = fetchKosis(cpiOrgId, cpiTblId, cpiItmId, cpiObjL1, objL2, startPrd, endPrd);
            if (items == null) {
                logger.warn("CPI 항목 수집 실패: {}", itemName);
                continue;
            }

            for (Map<String, Object> item : items) {
                try {
                    String prd = String.valueOf(item.get("PRD_DE"));
                    int year = Integer.parseInt(prd.substring(0, 4));
                    int month = Integer.parseInt(prd.substring(4, 6));
                    double value = Double.parseDouble(String.valueOf(item.get("DT")));

                    if (cpiDataRepository.findByYearAndMonthAndItemName(year, month, itemName).isPresent()) continue;

                    CpiData cpi = new CpiData();
                    cpi.setYear(year);
                    cpi.setMonth(month);
                    cpi.setItemName(itemName);
                    cpi.setCpi(value);
                    cpiDataRepository.save(cpi);
                    savedCount++;
                } catch (Exception e) {
                    logger.warn("CPI 데이터 파싱 실패 [{}]: {}", itemName, item);
                }
            }
            logger.info("CPI [{}] 수집 완료", itemName);
        }
        logger.info("CPI 저장 완료 - {}~{}, 총 {}건", startYear, endYear, savedCount);
        return savedCount;
    }

    /**
     * 특정 연월 CPI 수집 (테스트/스케줄러용)
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public int collectCpiByYearMonth(int year, int month) {
        String prd = year + String.format("%02d", month);
        int savedCount = 0;
        for (Map.Entry<String, String> entry : CPI_ITEM_CODES.entrySet()) {
            String itemName = entry.getKey();
            String objL2 = entry.getValue();
            List<Map<String, Object>> items = fetchKosis(cpiOrgId, cpiTblId, cpiItmId, cpiObjL1, objL2, prd, prd);
            if (items == null) { logger.warn("CPI 항목 수집 실패: {}", itemName); continue; }
            for (Map<String, Object> item : items) {
                try {
                    String p = String.valueOf(item.get("PRD_DE"));
                    int y = Integer.parseInt(p.substring(0, 4));
                    int m = Integer.parseInt(p.substring(4, 6));
                    double value = Double.parseDouble(String.valueOf(item.get("DT")));
                    if (cpiDataRepository.findByYearAndMonthAndItemName(y, m, itemName).isPresent()) continue;
                    CpiData cpi = new CpiData();
                    cpi.setYear(y); cpi.setMonth(m); cpi.setItemName(itemName); cpi.setCpi(value);
                    cpiDataRepository.save(cpi);
                    savedCount++;
                } catch (Exception e) { logger.warn("CPI 파싱 실패 [{}]: {}", itemName, item); }
            }
        }
        logger.info("CPI 저장 완료 - {}/{}, 총 {}건", year, month, savedCount);
        return savedCount;
    }

    // PPI 품목 코드: objL1 사용 (DT_404Y016 테이블)
    private static final Map<String, String> PPI_ITEM_CODES = Map.of(
            "배추",  "13102134764ACC_CD.10112101AA",
            "양배추", "13102134764ACC_CD.10112121AA",
            "양파",  "13102134764ACC_CD.10112117AA"
    );

    /**
     * 연도 범위로 PPI 수집 및 저장 (배추, 양배추, 양파)
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public int collectPpi(int startYear, int endYear) {
        String startPrd = startYear + "01";
        String endPrd = endYear + "12";

        int savedCount = 0;
        for (Map.Entry<String, String> entry : PPI_ITEM_CODES.entrySet()) {
            String itemName = entry.getKey();
            String objL1 = entry.getValue();

            List<Map<String, Object>> items = fetchKosis(ppiOrgId, ppiTblId, ppiItmId, objL1, "", startPrd, endPrd);
            if (items == null) {
                logger.warn("PPI 항목 수집 실패: {}", itemName);
                continue;
            }

            for (Map<String, Object> item : items) {
                try {
                    String prd = String.valueOf(item.get("PRD_DE"));
                    int year = Integer.parseInt(prd.substring(0, 4));
                    int month = Integer.parseInt(prd.substring(4, 6));
                    double value = Double.parseDouble(String.valueOf(item.get("DT")));

                    if (ppiDataRepository.findByYearAndMonthAndItemName(year, month, itemName).isPresent()) continue;

                    PpiData ppi = new PpiData();
                    ppi.setYear(year);
                    ppi.setMonth(month);
                    ppi.setItemName(itemName);
                    ppi.setPpi(value);
                    ppiDataRepository.save(ppi);
                    savedCount++;
                } catch (Exception e) {
                    logger.warn("PPI 데이터 파싱 실패 [{}]: {}", itemName, item);
                }
            }
            logger.info("PPI [{}] 수집 완료", itemName);
        }
        logger.info("PPI 저장 완료 - {}~{}, 총 {}건", startYear, endYear, savedCount);
        return savedCount;
    }

    /**
     * 특정 연월 PPI 수집 (테스트/스케줄러용)
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public int collectPpiByYearMonth(int year, int month) {
        String prd = year + String.format("%02d", month);
        int savedCount = 0;
        for (Map.Entry<String, String> entry : PPI_ITEM_CODES.entrySet()) {
            String itemName = entry.getKey();
            String objL1 = entry.getValue();
            List<Map<String, Object>> items = fetchKosis(ppiOrgId, ppiTblId, ppiItmId, objL1, "", prd, prd);
            if (items == null) { logger.warn("PPI 항목 수집 실패: {}", itemName); continue; }
            for (Map<String, Object> item : items) {
                try {
                    String p = String.valueOf(item.get("PRD_DE"));
                    int y = Integer.parseInt(p.substring(0, 4));
                    int m = Integer.parseInt(p.substring(4, 6));
                    double value = Double.parseDouble(String.valueOf(item.get("DT")));
                    if (ppiDataRepository.findByYearAndMonthAndItemName(y, m, itemName).isPresent()) continue;
                    PpiData ppi = new PpiData();
                    ppi.setYear(y); ppi.setMonth(m); ppi.setItemName(itemName); ppi.setPpi(value);
                    ppiDataRepository.save(ppi);
                    savedCount++;
                } catch (Exception e) { logger.warn("PPI 파싱 실패 [{}]: {}", itemName, item); }
            }
        }
        logger.info("PPI 저장 완료 - {}/{}, 총 {}건", year, month, savedCount);
        return savedCount;
    }

    private List<Map<String, Object>> fetchKosis(String orgId, String tblId, String itmId,
                                                  String objL1, String objL2,
                                                  String startPrd, String endPrd) {
        try {
            String url = BASE_URL
                    + "?method=getList"
                    + "&apiKey=" + apiKey
                    + "&itmId=" + itmId
                    + "&objL1=" + objL1
                    + "&objL2=" + objL2
                    + "&objL3=&objL4=&objL5=&objL6=&objL7=&objL8="
                    + "&format=json"
                    + "&jsonVD=Y"
                    + "&prdSe=M"
                    + "&startPrdDe=" + startPrd
                    + "&endPrdDe=" + endPrd
                    + "&orgId=" + orgId
                    + "&tblId=" + tblId;

            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            headers.set("Accept", "application/json, text/plain, */*");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            logger.info("KOSIS 요청 URL: {}", url);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            String raw = response.getBody();

            if (raw == null || !raw.trim().startsWith("[")) {
                logger.error("KOSIS API 비정상 응답 - orgId: {}, tblId: {}, 응답: {}", orgId, tblId,
                        raw != null ? raw.substring(0, Math.min(300, raw.length())) : "null");
                return null;
            }

            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(raw, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            logger.error("KOSIS API 호출 실패 - orgId: {}, tblId: {}: {}", orgId, tblId, e.getMessage());
        }
        return null;
    }
}
