package com.aksa.capacityplanner.benefit.adapter.out.persistence;

import com.aksa.capacityplanner.benefit.domain.BenefitType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "team_benefits")
@Getter
@Setter
@NoArgsConstructor
public class TeamBenefitJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(nullable = false, length = 20)
    private String period;

    @Enumerated(EnumType.STRING)
    @Column(name = "benefit_key", nullable = false, length = 40)
    private BenefitType type;

    @Column(name = "process_count")
    private Integer processCount;

    @Column(name = "value", precision = 18, scale = 2)
    private BigDecimal value;

    @Column(length = 3)
    private String currency;

    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
