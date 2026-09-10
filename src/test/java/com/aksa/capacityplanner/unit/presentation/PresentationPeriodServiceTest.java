package com.aksa.capacityplanner.unit.presentation;

import com.aksa.capacityplanner.presentation.domain.PeriodGrouper;
import com.aksa.capacityplanner.presentation.domain.PresentationDownloadLog;
import com.aksa.capacityplanner.presentation.domain.PresentationVersion;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.port.out.PresentationDownloadLogRepositoryPort;
import com.aksa.capacityplanner.presentation.port.out.PresentationRepositoryPort;
import com.aksa.capacityplanner.presentation.port.out.PresentationVersionRepositoryPort;
import com.aksa.capacityplanner.presentation.usecase.PresentationService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Donem listesinin SERVIS uzerinden uctan uca dogrulanmasi.
 *
 * PeriodGrouperTest yalnizca gruplama mantigini olcer; buradaki testler
 * zincirin tamamini kanitlar: PO tarihi yazar -> upsert onu ayristirip
 * period_start/period_end'e dokur -> listPeriods bunlari donemlere toplar.
 * Zincirin ortasindaki bir kopukluk (orn. tarihin kaydedilirken duselmesi)
 * tek basina gruplama testine yakalanmazdi.
 */
class PresentationPeriodServiceTest {

    /** Bellek ici depo - projede Mockito kullanilmiyor, port dogrudan taklit edilir. */
    private static final class InMemoryPresentations implements PresentationRepositoryPort {
        private final List<SprintPresentation> rows = new ArrayList<>();
        private long seq = 1;
        /** Her kayitta artan zaman - "en son guncellenen" kurali icin gerekli. */
        private Instant saat = Instant.parse("2026-09-09T09:00:00Z");

        @Override
        public SprintPresentation save(SprintPresentation p) {
            if (p.getId() == null) {
                p.setId(seq++);
                p.setCreatedAt(saat);
            }
            saat = saat.plusSeconds(60);
            rows.removeIf(r -> r.getId().equals(p.getId()));
            SprintPresentation kopya = new SprintPresentation(p.getId(), p.getTeamId(), p.getSprintNo(),
                    p.getDateRange(), p.getContent(), p.getCurrentVersion(), p.getUpdatedBy(),
                    p.getCreatedAt(), saat, p.getFinalizedAt(), p.getFinalizedBy(),
                    p.getPeriodStart(), p.getPeriodEnd());
            rows.add(kopya);
            return kopya;
        }

        @Override public void deleteById(Long id) { rows.removeIf(r -> r.getId().equals(id)); }
        @Override public Optional<SprintPresentation> findById(Long id) { return rows.stream().filter(r -> r.getId().equals(id)).findFirst(); }
        @Override public Optional<SprintPresentation> findByTeamIdAndSprintNo(Long teamId, String sprintNo) {
            return rows.stream().filter(r -> r.getTeamId().equals(teamId) && r.getSprintNo().equals(sprintNo)).findFirst();
        }
        @Override public List<SprintPresentation> findByTeamId(Long teamId) { return rows.stream().filter(r -> r.getTeamId().equals(teamId)).toList(); }
        @Override public Optional<SprintPresentation> findByIdReadOnly(Long id) { return findById(id); }
        @Override public List<SprintPresentation> findByTeamIdReadOnly(Long teamId) { return findByTeamId(teamId); }
        @Override public List<SprintPresentation> findLatestPerTeamReadOnly(List<Long> teamIds) { return List.of(); }
        /** Gercek adaptor gibi: donem tarihi olmayan kayitlari hic dondurmez. */
        @Override public List<SprintPresentation> findAllForPeriodGrouping() {
            return rows.stream().filter(r -> r.getPeriodEnd() != null).toList();
        }
    }

    private static final class InMemoryVersions implements PresentationVersionRepositoryPort {
        private final List<PresentationVersion> rows = new ArrayList<>();
        @Override public PresentationVersion save(PresentationVersion v) { rows.add(v); return v; }
        @Override public List<PresentationVersion> findByPresentationId(Long id) {
            return rows.stream().filter(r -> r.getPresentationId().equals(id)).toList();
        }
        @Override public Optional<PresentationVersion> findByPresentationIdAndVersion(Long id, int v) {
            return rows.stream().filter(r -> r.getPresentationId().equals(id) && r.getVersion() == v).findFirst();
        }
        @Override public void deleteByPresentationIdAndVersionGreaterThan(Long id, int v) {
            rows.removeIf(r -> r.getPresentationId().equals(id) && r.getVersion() > v);
        }
    }

    private static final class NoopLogs implements PresentationDownloadLogRepositoryPort {
        @Override public PresentationDownloadLog save(PresentationDownloadLog log) { return log; }
    }

    private final InMemoryPresentations depo = new InMemoryPresentations();
    private final PresentationService service = new PresentationService(depo, new InMemoryVersions(), new NoopLogs());

    private SprintPresentation kaydet(long teamId, String sprintNo, String aralik) {
        Map<String, Object> icerik = new HashMap<>();
        icerik.put("sprint", sprintNo);
        return service.upsert(null, teamId, sprintNo, aralik, icerik, "40538");
    }

    /** Uretimdeki 23 Temmuz donemi - yedi ekip, farkli tarih yazim bicimleriyle. */
    private void yirmiUcTemmuzDonemi() {
        kaydet(1L, "12", "10.07.2026 – 23.07.2026");   // Doküman/Süreç
        kaydet(2L, "16", "9 Temmuz – 23 Temmuz");       // RPA
        kaydet(4L, "3", "10 Temmuz – 23 Temmuz");       // İş Zekası
        kaydet(5L, "5", "10 Temmuz – 23 Temmuz");       // Mobil
        kaydet(6L, "10", "10 Temmuz – 23 Temmuz");      // CBS
        kaydet(7L, "7", "10 Temmuz – 24 Temmuz");       // Yapay Zeka
        kaydet(8L, "11", "13 Temmuz – 24 Temmuz");      // Dijital
    }

    @Test
    void kaydedilenTarihDonemeDonusur() {
        yirmiUcTemmuzDonemi();

        List<PeriodGrouper.Donem> donemler = service.listPeriods();

        assertThat(donemler).hasSize(1);
        assertThat(donemler.get(0).takimSayisi()).isEqualTo(7);
        assertThat(donemler.get(0).bitis()).isEqualTo(LocalDate.of(2026, 7, 23));
    }

    /** Farkli donemler ayri kalir ve EN YENI donem basta gelir. */
    @Test
    void donemlerAyrilirVeEnYeniBastaGelir() {
        yirmiUcTemmuzDonemi();
        kaydet(2L, "15", "18 Haziran – 9 Temmuz");
        kaydet(4L, "2", "19 Haziran – 9 Temmuz");
        kaydet(2L, "18", "06.08.2026 – 03.09.2026");

        List<PeriodGrouper.Donem> donemler = service.listPeriods();

        assertThat(donemler).extracting(PeriodGrouper.Donem::bitis).containsExactly(
                LocalDate.of(2026, 9, 3), LocalDate.of(2026, 7, 23), LocalDate.of(2026, 7, 9));
    }

    /**
     * URETIMDEKI DURUM: Dijital Uygulamalar'in S10 (10-23 Temmuz) ve S11
     * (13-24 Temmuz) tarihleri ayni doneme dusuyor. Ortak sunuma yalnizca
     * BIRI girmeli - en son guncellenen.
     */
    @Test
    void ayniTakimIkiSunumBirakirsaSonGuncellenenSecilir() {
        yirmiUcTemmuzDonemi();
        SprintPresentation s10 = kaydet(8L, "10", "10 Temmuz – 23 Temmuz");

        PeriodGrouper.Donem donem = service.listPeriods().get(0);

        assertThat(donem.sunumlar()).as("iki sunum da doneme dusmeli").hasSize(8);
        assertThat(donem.takimSayisi()).as("ama takim sayisi degismemeli").isEqualTo(7);
        assertThat(donem.cakisanTakimlar()).containsExactly(8L);
        assertThat(donem.takiminSunumu(8L).getId()).isEqualTo(s10.getId());
    }

    /** Revizyon "en son guncellenen"i degistirir - Cagdas Bey hep guncel icerigi gormeli. */
    @Test
    void revizyonSecimiGuncelSunumaCevirir() {
        yirmiUcTemmuzDonemi();
        SprintPresentation s10 = kaydet(8L, "10", "10 Temmuz – 23 Temmuz");
        assertThat(service.listPeriods().get(0).takiminSunumu(8L).getId()).isEqualTo(s10.getId());

        Map<String, Object> yeni = new HashMap<>();
        yeni.put("sprint", "11");
        yeni.put("sections", Map.of("done", "revize"));
        SprintPresentation s11 = service.upsert(depo.findByTeamIdAndSprintNo(8L, "11").orElseThrow().getId(),
                8L, "11", "13 Temmuz – 24 Temmuz", yeni, "40538");

        assertThat(service.listPeriods().get(0).takiminSunumu(8L).getId())
                .as("S11 revize edildi, artik ortak sunuma o girmeli")
                .isEqualTo(s11.getId());
    }

    /** Tarihi cozulemeyen sunum hicbir doneme dusmez - sessizce yanlis yere gitmemeli. */
    @Test
    void cozulemeyenTarihDonemeGirmez() {
        kaydet(1L, "12", "10.07.2026 – 23.07.2026");
        SprintPresentation belirsiz = kaydet(2L, "16", "sprint sonu");

        assertThat(belirsiz.getPeriodEnd()).isNull();
        List<PeriodGrouper.Donem> donemler = service.listPeriods();
        assertThat(donemler).hasSize(1);
        assertThat(donemler.get(0).sunumlar()).extracting(SprintPresentation::getTeamId).containsExactly(1L);
    }

    @Test
    void hicSunumYoksaListeBostur() {
        assertThat(service.listPeriods()).isEmpty();
    }
}
