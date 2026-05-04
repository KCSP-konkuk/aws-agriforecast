package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "real_item_price")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RealItemPrice {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ_NO_A020")
    private Integer seqNoA020;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "SEQ_NO_A021", referencedColumnName = "SEQ_NO_A021", nullable = false)
    private ItemCode itemCode;
    
    @Column(name = "GRADE", length = 20)
    private String grade;
    
    @Column(name = "MARKET", length = 50)
    private String market;
    
    @Column(name = "PRICE_DATE", nullable = false)
    private LocalDate priceDate;
    
    @Column(name = "PRICE", nullable = false)
    private Integer price;
}
