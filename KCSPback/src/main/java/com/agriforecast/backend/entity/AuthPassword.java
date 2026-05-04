package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "auth_password")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AuthPassword {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ_NO_A012")
    private Integer seqNoA012;
    
    @OneToOne
    @JoinColumn(name = "SEQ_NO_A010", referencedColumnName = "SEQ_NO_A010", nullable = false, unique = true)
    private MemberUser memberUser;
    
    @Column(name = "SALT", nullable = false, length = 128)
    private String salt;
    
    @Column(name = "PASSWORD", nullable = false, length = 128)
    private String password;
    
    @CreationTimestamp
    @Column(name = "PASS_UPDATE", nullable = false, updatable = false)
    private LocalDateTime passUpdate;
}

