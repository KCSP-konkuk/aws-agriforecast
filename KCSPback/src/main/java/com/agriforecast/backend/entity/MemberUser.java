package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "member_user")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberUser {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ_NO_A010")
    private Integer seqNoA010;
    
    @Column(name = "ID", unique = true, nullable = false, length = 20)
    private String id;
    
    @Column(name = "IS_ACTIVE", nullable = false)
    private Boolean isActive = true;
    
    // 1:1 관계 - AuthPassword
    @OneToOne(mappedBy = "memberUser", cascade = CascadeType.ALL, orphanRemoval = true)
    private AuthPassword authPassword;
    
    // 1:1 관계 - MemberProfile
    @OneToOne(mappedBy = "memberUser", cascade = CascadeType.ALL, orphanRemoval = true)
    private MemberProfile memberProfile;
}

