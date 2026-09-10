package com.aksa.capacityplanner.unit.presentation;

import com.aksa.capacityplanner.common.domain.NotFoundException;
import com.aksa.capacityplanner.presentation.domain.PresentationDownloadLog;
import com.aksa.capacityplanner.presentation.domain.PresentationVersion;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.port.out.PresentationDownloadLogRepositoryPort;
import com.aksa.capacityplanner.presentation.port.out.PresentationRepositoryPort;
import com.aksa.capacityplanner.presentation.port.out.PresentationVersionRepositoryPort;
import com.aksa.capacityplanner.presentation.usecase.PresentationService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * "Sunumum hazir" isareti (bkz. V33__presentation_finalized.sql).
 *
 * En kritik davranis: isaret REVIZYONDA DUSMEZ. Gözde'nin karari geregi ortak
 * sunum her zaman o donemin EN SON icerigini gostermeli; isaret her kayitta
 * dusseydi bir ekip sunumunu revize ettigi anda ortak sunum bozulur ve bir
 * daha hic tetiklenmezdi.
 */
class PresentationFinalizeTest {

    /** Bellek ici depo - projede Mockito kullanilmiyor, port dogrudan taklit edilir. */
    private static final class InMemoryPresentations implements PresentationRepositoryPort {
        private final List<SprintPresentation> rows = new ArrayList<>();
        private long seq = 1;
        /** Gercek adapter her kayitta entity'yi SIFIRDAN kurup merge ediyor; burada da kopyalayarak ayni davranis taklit edilir. */
        @Override
        public SprintPresentation save(SprintPresentation p) {
            if (p.getId() == null) {
                p.setId(seq++);
                p.setCreatedAt(Instant.parse("2026-09-09T09:00:00Z"));
            }
            rows.removeIf(r -> r.getId().equals(p.getId()));
            SprintPresentation kopya = new SprintPresentation(p.getId(), p.getTeamId(), p.getSprintNo(),
                    p.getDateRange(), p.getContent(), p.getCurrentVersion(), p.getUpdatedBy(),
                    p.getCreatedAt(), Instant.parse("2026-09-09T12:00:00Z"),
                    p.getFinalizedAt(), p.getFinalizedBy(),
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
        @Override public List<PresentationVersion> findByPresentationId(Long id) { return rows.stream().filter(r -> r.getPresentationId().equals(id)).toList(); }
        @Override public Optional<PresentationVersion> findByPresentationIdAndVersion(Long id, int v) {
            return rows.stream().filter(r -> r.getPresentationId().equals(id) && r.getVersion() == v).findFirst();
        }
        @Override public void deleteByPresentationIdAndVersionGreaterThan(Long id, int v) {
            rows.removeIf(r -> r.getPresentationId().equals(id) && r.getVersion() > v);
        }
        int sayi() { return rows.size(); }
    }

    private static final class NoopLogs implements PresentationDownloadLogRepositoryPort {
        @Override public PresentationDownloadLog save(PresentationDownloadLog log) { return log; }
    }

    private final InMemoryPresentations depo = new InMemoryPresentations();
    private final InMemoryVersions surumler = new InMemoryVersions();
    private final PresentationService service = new PresentationService(depo, surumler, new NoopLogs());

    private SprintPresentation yeniSunum() {
        Map<String, Object> icerik = new HashMap<>();
        icerik.put("sprint", "18");
        return service.upsert(null, 1L, "18", "24 Temmuz – 6 Ağustos", icerik, "40538");
    }

    @Test
    void yeniSunumHazirDegildir() {
        SprintPresentation p = yeniSunum();
        assertThat(p.getFinalizedAt()).isNull();
        assertThat(p.isFinalized()).isFalse();
    }

    @Test
    void hazirIsaretiKonurVeGeriAlinir() {
        SprintPresentation p = yeniSunum();

        SprintPresentation hazir = service.setFinalized(p.getId(), true, "29547");
        assertThat(hazir.isFinalized()).isTrue();
        assertThat(hazir.getFinalizedBy()).isEqualTo("29547");
        assertThat(hazir.getFinalizedAt()).isNotNull();

        SprintPresentation geri = service.setFinalized(p.getId(), false, "29547");
        assertThat(geri.isFinalized()).isFalse();
        assertThat(geri.getFinalizedBy()).isNull();
        assertThat(geri.getFinalizedAt()).isNull();
    }

    /** ISIN KALBI: revizyon isareti DUSURMEMELI. */
    @Test
    void revizyonHazirIsaretiniDusurmez() {
        SprintPresentation p = yeniSunum();
        service.setFinalized(p.getId(), true, "29547");

        Map<String, Object> yeniIcerik = new HashMap<>();
        yeniIcerik.put("sprint", "18");
        yeniIcerik.put("sections", Map.of("done", "revize edildi"));
        SprintPresentation revize = service.upsert(p.getId(), 1L, "18", "24 Temmuz – 6 Ağustos", yeniIcerik, "40538");

        assertThat(revize.isFinalized())
                .as("revizyondan sonra hazir isareti korunmali - yoksa ortak sunum bir daha tetiklenmez")
                .isTrue();
        assertThat(revize.getFinalizedBy()).isEqualTo("29547");
        assertThat(revize.getCurrentVersion()).isEqualTo(2);
    }

    /** updateInPlace (Ortak Sunum ekranindaki "Güncelle") de isareti dusurmemeli. */
    @Test
    void yerindeGuncellemeHazirIsaretiniDusurmez() {
        SprintPresentation p = yeniSunum();
        service.setFinalized(p.getId(), true, "29547");

        Map<String, Object> yeniIcerik = new HashMap<>();
        yeniIcerik.put("sprint", "18");
        SprintPresentation guncel = service.updateInPlace(p.getId(), "24 Temmuz – 6 Ağustos", yeniIcerik, "40538");

        assertThat(guncel.isFinalized()).isTrue();
    }

    @Test
    void isaretlemekYeniSurumOlusturmaz() {
        SprintPresentation p = yeniSunum();
        int oncekiSurumSayisi = surumler.sayi();

        service.setFinalized(p.getId(), true, "29547");
        service.setFinalized(p.getId(), false, "29547");

        assertThat(surumler.sayi())
                .as("hazir/geri al bir icerik degisikligi degil - surum gecmisini sismemeli")
                .isEqualTo(oncekiSurumSayisi);
        assertThat(service.getById(p.getId()).getCurrentVersion()).isEqualTo(1);
    }

    @Test
    void ayniDurumTekrarYazilmaz() {
        SprintPresentation p = yeniSunum();
        SprintPresentation ilk = service.setFinalized(p.getId(), true, "29547");
        SprintPresentation ikinci = service.setFinalized(p.getId(), true, "35840");

        assertThat(ikinci.getFinalizedAt())
                .as("zaten hazirsa dokunulmamali - isaretleyen kisi degismemeli")
                .isEqualTo(ilk.getFinalizedAt());
        assertThat(ikinci.getFinalizedBy()).isEqualTo("29547");
    }

    @Test
    void olmayanSunumHataVerir() {
        assertThatThrownBy(() -> service.setFinalized(9999L, true, "29547"))
                .isInstanceOf(NotFoundException.class);
    }
}
