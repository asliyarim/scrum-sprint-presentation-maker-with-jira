package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "sprint_presentations")
@Getter
@Setter
@NoArgsConstructor
public class SprintPresentationJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(name = "sprint_no", nullable = false)
    private String sprintNo;

    @Column(name = "date_range")
    private String dateRange;

    // columnDefinition kasten belirtilmiyor: Hibernate dialect'e gore uygun
    // JSON tipini kendisi secer (Postgres -> jsonb).
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> content = new HashMap<>();

    @Column(name = "current_version", nullable = false)
    private int currentVersion;

    @Column(name = "updated_by")
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * PO sunumu "hazir" olarak isaretledigi an; NULL ise henuz hazir degil.
     * Revizyonda DUSMEZ - bkz. V33__presentation_finalized.sql.
     *
     * DIKKAT: PresentationPersistenceAdapter.toEntity her kayitta SIFIRDAN bir
     * entity kurup merge ettigi icin bu alan orada da eslenmek ZORUNDA; aksi
     * halde her "Kaydet" isareti sessizce silerdi.
     */
    @Column(name = "finalized_at")
    private Instant finalizedAt;

    @Column(name = "finalized_by")
    private String finalizedBy;

    /** Sprint donemi - date_range metninden turetilir/takvimden secilir (V34). */
    @Column(name = "period_start")
    private LocalDate periodStart;

    @Column(name = "period_end")
    private LocalDate periodEnd;
}
