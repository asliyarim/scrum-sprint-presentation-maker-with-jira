package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Donem basina takim sirasi (bkz. V35__period_team_order.sql).
 * Anahtar donemin bitis tarihi - her donemin TEK sirasi vardir, ikinci kez
 * siralayan ustune yazar ("son siralayan kazanir").
 */
@Entity
@Table(name = "period_team_order")
@Getter
@Setter
@NoArgsConstructor
public class PeriodTeamOrderJpaEntity {

    @Id
    @Column(name = "period_end")
    private LocalDate periodEnd;

    // columnDefinition kasten belirtilmiyor - Hibernate dialect'e gore uygun
    // JSON tipini kendisi secer (Postgres -> jsonb), bkz. JointPresentationJpaEntity.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "team_ids", nullable = false)
    private List<Long> teamIds = new ArrayList<>();

    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
