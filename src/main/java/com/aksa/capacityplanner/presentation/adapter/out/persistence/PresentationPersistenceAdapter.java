package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.port.out.PresentationRepositoryPort;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class PresentationPersistenceAdapter implements PresentationRepositoryPort {

    private final SprintPresentationJpaRepository jpaRepository;
    private final SprintPresentationReadOnlyJpaRepository readOnlyJpaRepository;

    public PresentationPersistenceAdapter(SprintPresentationJpaRepository jpaRepository,
                                           SprintPresentationReadOnlyJpaRepository readOnlyJpaRepository) {
        this.jpaRepository = jpaRepository;
        this.readOnlyJpaRepository = readOnlyJpaRepository;
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public SprintPresentation save(SprintPresentation presentation) {
        SprintPresentationJpaEntity entity = toEntity(presentation);
        // saveAndFlush KULLANILIYOR: save() merge-only oldugu icin @UpdateTimestamp
        // henuz flush edilmeden donen entity'de updatedAt null gorunuyordu.
        SprintPresentationJpaEntity saved = jpaRepository.saveAndFlush(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<SprintPresentation> findById(Long id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<SprintPresentation> findByTeamIdAndSprintNo(Long teamId, String sprintNo) {
        return jpaRepository.findByTeamIdAndSprintNo(teamId, sprintNo).map(this::toDomain);
    }

    @Override
    public List<SprintPresentation> findByTeamId(Long teamId) {
        return jpaRepository.findByTeamId(teamId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<SprintPresentation> findByIdReadOnly(Long id) {
        return readOnlyJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public List<SprintPresentation> findByTeamIdReadOnly(Long teamId) {
        return readOnlyJpaRepository.findByTeamId(teamId).stream().map(this::toDomain).toList();
    }

    private static final Pattern SPRINT_NO_DIGITS = Pattern.compile("\\d+");

    /** sprintNo icindeki ilk sayi dizisini cikarir (orn. "Sprint 7" -> 7); sayi yoksa -1 (en dusuk oncelik). */
    private static long sprintNoRank(String sprintNo) {
        if (sprintNo == null) return -1;
        Matcher m = SPRINT_NO_DIGITS.matcher(sprintNo);
        return m.find() ? Long.parseLong(m.group()) : -1;
    }

    @Override
    public List<SprintPresentation> findLatestPerTeamReadOnly(List<Long> teamIds) {
        // "En son surum" hem sprint numarasina (once) hem de guncelleme
        // zamanina (esitlikte) gore belirlenir - bkz. kullanici tercihi.
        Comparator<SprintPresentationReadOnlyJpaEntity> byLatest =
                Comparator.<SprintPresentationReadOnlyJpaEntity>comparingLong(e -> sprintNoRank(e.getSprintNo()))
                        .thenComparing(SprintPresentationReadOnlyJpaEntity::getUpdatedAt)
                        .reversed();
        Map<Long, SprintPresentationReadOnlyJpaEntity> latestByTeam = new LinkedHashMap<>();
        readOnlyJpaRepository.findByTeamIdIn(teamIds).stream()
                .sorted(byLatest)
                .forEach(e -> latestByTeam.putIfAbsent(e.getTeamId(), e));
        return latestByTeam.values().stream().map(this::toDomain).toList();
    }

    private SprintPresentation toDomain(SprintPresentationReadOnlyJpaEntity entity) {
        return new SprintPresentation(entity.getId(), entity.getTeamId(), entity.getSprintNo(), entity.getDateRange(),
                entity.getContent(), entity.getCurrentVersion(), entity.getUpdatedBy(),
                entity.getCreatedAt(), entity.getUpdatedAt(),
                entity.getFinalizedAt(), entity.getFinalizedBy(),
                entity.getPeriodStart(), entity.getPeriodEnd());
    }

    private SprintPresentationJpaEntity toEntity(SprintPresentation presentation) {
        SprintPresentationJpaEntity entity = new SprintPresentationJpaEntity();
        entity.setId(presentation.getId());
        entity.setTeamId(presentation.getTeamId());
        entity.setSprintNo(presentation.getSprintNo());
        entity.setDateRange(presentation.getDateRange());
        entity.setContent(presentation.getContent());
        entity.setCurrentVersion(presentation.getCurrentVersion());
        entity.setUpdatedBy(presentation.getUpdatedBy());
        // KRITIK: bu metot her kayitta SIFIRDAN bir entity kurup merge ediyor.
        // "Hazir" isareti burada eslenmezse, PO sunumu her kaydettiginde isaret
        // sessizce NULL'a doner ve ortak sunum bir daha hic tetiklenmezdi.
        entity.setFinalizedAt(presentation.getFinalizedAt());
        entity.setFinalizedBy(presentation.getFinalizedBy());
        // toEntity sifirdan kurup merge ettigi icin bunlar da eslenmek ZORUNDA
        // (bkz. yukaridaki finalized uyarisi) - yoksa her kayitta silinirlerdi.
        entity.setPeriodStart(presentation.getPeriodStart());
        entity.setPeriodEnd(presentation.getPeriodEnd());
        return entity;
    }

    private SprintPresentation toDomain(SprintPresentationJpaEntity entity) {
        return new SprintPresentation(entity.getId(), entity.getTeamId(), entity.getSprintNo(), entity.getDateRange(),
                entity.getContent(), entity.getCurrentVersion(), entity.getUpdatedBy(),
                entity.getCreatedAt(), entity.getUpdatedAt(),
                entity.getFinalizedAt(), entity.getFinalizedBy(),
                entity.getPeriodStart(), entity.getPeriodEnd());
    }
}
