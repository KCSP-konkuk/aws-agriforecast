package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "member_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberProfile {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ_NO_A011")
    private Integer seqNoA011;
    
    @OneToOne
    @JoinColumn(name = "SEQ_NO_A010", referencedColumnName = "SEQ_NO_A010", nullable = false, unique = true)
    private MemberUser memberUser;
    
    @Column(name = "NAME", nullable = false, length = 20)
    private String name;
    
    @Column(name = "BIRTH")
    private LocalDate birth;
    
    @Column(name = "EMAIL", length = 50)
    private String email;
    
    @Column(name = "GENDER", length = 1)
    private String gender;
    
    @CreationTimestamp
    @Column(name = "AUTH_DATE", nullable = false, updatable = false)
    private LocalDateTime authDate;
}

