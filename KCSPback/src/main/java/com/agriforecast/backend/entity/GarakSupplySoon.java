package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * 가락시장 순별 반입량 (농넷 getGarakSoonList.do) — GarakSupplyService
 * 순 첫날(1 · 11 · 21일)마다 한 행. 진행 중인 순은 어제까지 합이라 다음 수집 때 고쳐진다
 */
@Entity
@Table(name = "garak_supply_soon", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"ITEM_NAME", "SOON_START"})
})
@Getter
@Setter
@NoArgsConstructor
public class GarakSupplySoon {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /** 작업대 품목 이름 (KAMIS 품목과 같다) */
    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "SOON_START", nullable = false)
    private LocalDate soonStart;

    /** 순 반입량 (톤). 받았지만 기록이 없는 순(값 0)은 비워 둔다 */
    @Column(name = "VOLUME")
    private Double volume;

    /** 반입 1 · 2위 산지와 그 양(톤). 여러 코드를 더한 품목은 비워 둔다 */
    @Column(name = "RANK1_REGION", length = 50)
    private String rank1Region;

    @Column(name = "RANK1_VOLUME")
    private Double rank1Volume;

    @Column(name = "RANK2_REGION", length = 50)
    private String rank2Region;

    @Column(name = "RANK2_VOLUME")
    private Double rank2Volume;

    /** 받은 범위 메모 (예: 마늘 전체) — 작업대 출처 표시에 붙는다 */
    @Column(name = "SCOPE", length = 50)
    private String scope;
}
