package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * sprint_presentations_readonly view'inin (bkz. V5 migration) JPA karsiligi.
 * @Immutable: Hibernate bu entity uzerinden asla UPDATE/INSERT uretmez - okuma
 * yolunu (baska takim/admin goruntuleme) yazma yolundan (SprintPresentationJpaEntity,
 * base tablo) ayirmak icin kullanilir.
 */
@Entity
@Immutable
@Table(name = "sprint_presentations_readonly")
@Getter
@Setter
@NoArgsConstructor
public class SprintPresentationReadOnlyJpaEntity {

    @Id
    private Long id;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "sprint_no")
    private String sprintNo;

    @Column(name = "date_range")
    private String dateRange;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> content = new HashMap<>();

    @Column(name = "current_version")
    private int currentVersion;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "finalized_at")
    private Instant finalizedAt;

    @Column(name = "finalized_by")
    private String finalizedBy;

    @Column(name = "period_start")
    private LocalDate periodStart;

    @Column(name = "period_end")
    private LocalDate periodEnd;
}
