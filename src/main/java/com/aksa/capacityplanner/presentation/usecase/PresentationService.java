package com.aksa.capacityplanner.presentation.usecase;

import com.aksa.capacityplanner.common.domain.ConflictException;
import com.aksa.capacityplanner.common.domain.NotFoundException;
import com.aksa.capacityplanner.presentation.domain.PresentationDownloadLog;
import com.aksa.capacityplanner.presentation.domain.PresentationVersion;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.domain.SprintPeriodParser;
import com.aksa.capacityplanner.presentation.port.in.PresentationUseCase;
import com.aksa.capacityplanner.presentation.port.out.PresentationDownloadLogRepositoryPort;
import com.aksa.capacityplanner.presentation.port.out.PresentationRepositoryPort;
import com.aksa.capacityplanner.presentation.port.out.PresentationVersionRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class PresentationService implements PresentationUseCase {

    private final PresentationRepositoryPort presentationRepository;
    private final PresentationVersionRepositoryPort versionRepository;
    /** Donem tarihlerinin yil tahmininde kullanilan saat dilimi. */
    private static final ZoneId ISTANBUL = ZoneId.of("Europe/Istanbul");

    private final PresentationDownloadLogRepositoryPort downloadLogRepository;

    public PresentationService(PresentationRepositoryPort presentationRepository,
                                PresentationVersionRepositoryPort versionRepository,
                                PresentationDownloadLogRepositoryPort downloadLogRepository) {
        this.presentationRepository = presentationRepository;
        this.versionRepository = versionRepository;
        this.downloadLogRepository = downloadLogRepository;
    }

    @Override
    public List<SprintPresentation> listByTeam(Long teamId) {
        return presentationRepository.findByTeamId(teamId);
    }

    @Override
    public void delete(Long id) {
        getById(id); // yoksa 404
        presentationRepository.deleteById(id);
    }

    @Override
    public SprintPresentation getById(Long id) {
        return presentationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Sunum bulunamadi: id=" + id));
    }

    @Override
    public List<SprintPresentation> listByTeamReadOnly(Long teamId) {
        return presentationRepository.findByTeamIdReadOnly(teamId);
    }

    @Override
    public SprintPresentation getByIdReadOnly(Long id) {
        return presentationRepository.findByIdReadOnly(id)
                .orElseThrow(() -> new NotFoundException("Sunum bulunamadi: id=" + id));
    }

    @Override
    @Transactional
    public SprintPresentation upsert(Long id, Long teamId, String sprintNo, String dateRange, Map<String, Object> content, String updatedBySicil) {
        SprintPresentation presentation;
        if (id != null) {
            // Mevcut sunum DUZENLENIYOR. Sprint no degistiyse bu bir RENAME'dir -
            // yeni kart olusturulmaz, ayni kaydin sprint_no'su guncellenir. Ama
            // hedef sprint no bu takimda BASKA bir kayitta zaten varsa uzerine
            // yazmak veri kaybi olur; onun yerine 409 firlatilir (kullanici karari
            // 2026-09-01: "Sprint X zaten var" uyari, kaydetme).
            presentation = getById(id);
            if (!presentation.getSprintNo().equals(sprintNo)) {
                presentationRepository.findByTeamIdAndSprintNo(presentation.getTeamId(), sprintNo)
                        .filter(other -> !other.getId().equals(presentation.getId()))
                        .ifPresent(other -> {
                            throw new ConflictException("Sprint " + sprintNo + " zaten var. Farkli bir sprint numarasi girin ya da o sunumu duzenleyin.");
                        });
                presentation.setSprintNo(sprintNo);
            }
        } else {
            // Yeni sunum ya da ayni (teamId, sprintNo) uzerine yeni surum - eski davranis.
            presentation = presentationRepository.findByTeamIdAndSprintNo(teamId, sprintNo)
                    .orElseGet(() -> {
                        SprintPresentation created = new SprintPresentation();
                        created.setTeamId(teamId);
                        created.setSprintNo(sprintNo);
                        created.setCurrentVersion(0);
                        return created;
                    });
        }
        // Bir sonraki surum numarasi currentVersion+1 DEGIL, versions tablosundaki
        // GERCEK en yuksek numaradan hesaplanir - rollback() artik currentVersion'i
        // GERIYE (ornegin v3'ten v2'ye) dusurebildigi icin, "checkout edilmis" bir
        // eski surumden sonra kaydedince zaten var olan bir versiyon numarasiyla
        // (orn. eski v3) CAKISMAMASI gerekir (uq_presentation_versions_presentation_version).
        int nextVersion = presentation.getId() == null ? 1 : nextVersionNumber(presentation.getId());
        presentation.setDateRange(dateRange);
        presentation.setContent(content);
        presentation.setUpdatedBy(updatedBySicil);
        presentation.setCurrentVersion(nextVersion);
        donemTarihleriniTuret(presentation);
        SprintPresentation saved = presentationRepository.save(presentation);

        versionRepository.save(new PresentationVersion(null, saved.getId(), nextVersion,
                content, updatedBySicil, Instant.now()));
        return saved;
    }

    /**
     * date_range metninden donem tarihlerini turetip kayda yazar.
     *
     * Neden metinden turetiyoruz da ayri bir alan olarak ISTEMIYORUZ: date_range
     * zaten slaytta/PPTX'te gorunen tek kaynak. Takvimden secim yapildiginda
     * arayuz bu metni kesin bir bicimde ("dd.MM.yyyy – dd.MM.yyyy") uretiyor,
     * yani ayristirma belirsiz degil. Boylece API sozlesmesi hic degismiyor ve
     * eski istemciler de calismaya devam ediyor.
     *
     * Cevrilemezse alanlar NULL kalir - sunum yine kaydedilir, sadece otomatik
     * donem eslestirmesine giremez.
     */
    private void donemTarihleriniTuret(SprintPresentation presentation) {
        LocalDate referans = presentation.getCreatedAt() != null
                ? LocalDate.ofInstant(presentation.getCreatedAt(), ISTANBUL)
                : LocalDate.now(ISTANBUL);
        SprintPeriodParser.parse(presentation.getDateRange(), referans).ifPresentOrElse(
                donem -> {
                    presentation.setPeriodStart(donem.start());
                    presentation.setPeriodEnd(donem.end());
                },
                () -> {
                    presentation.setPeriodStart(null);
                    presentation.setPeriodEnd(null);
                });
    }

    private int nextVersionNumber(Long presentationId) {
        return versionRepository.findByPresentationId(presentationId).stream()
                .mapToInt(PresentationVersion::getVersion).max().orElse(0) + 1;
    }

    @Override
    @Transactional
    public SprintPresentation updateInPlace(Long presentationId, String dateRange, Map<String, Object> content, String updatedBySicil) {
        SprintPresentation presentation = getById(presentationId);
        presentation.setDateRange(dateRange);
        presentation.setContent(content);
        presentation.setUpdatedBy(updatedBySicil);
        donemTarihleriniTuret(presentation);
        SprintPresentation saved = presentationRepository.save(presentation);

        // currentVersion'a karsilik gelen versions kaydini da senkron tutar -
        // yeni bir surum EKLENMEZ, sadece VAR OLAN guncellenir (id korunarak).
        versionRepository.findByPresentationIdAndVersion(presentationId, saved.getCurrentVersion())
                .ifPresent(v -> versionRepository.save(new PresentationVersion(
                        v.getId(), presentationId, v.getVersion(), content, updatedBySicil, Instant.now())));
        return saved;
    }

    @Override
    public List<PresentationVersion> listVersions(Long presentationId) {
        getById(presentationId);
        return versionRepository.findByPresentationId(presentationId);
    }

    @Override
    public PresentationVersion getVersion(Long presentationId, int version) {
        getById(presentationId); // sunum var mi dogrula (yoksa 404)
        return versionRepository.findByPresentationIdAndVersion(presentationId, version)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Sunum " + presentationId + " icin " + version + ". surum bulunamadi."));
    }

    /**
     * GERCEK checkout: hedef surumun icerigini/numarasini dogrudan head'e
     * (sprint_presentations satirina) yazar - versions tablosuna HIC
     * DOKUNULMAZ (ne silme ne yeni satir ekleme). "v3'ten v2'ye donulunce
     * v3 SILINMESIN, yeni bir v4 de OLUSMASIN - sadece guncel surum v2 olsun,
     * onizlemede/Duzenle'de/PPTX indir'de v2 gorunsun" (bkz. kullanici
     * bildirimi - hem "sonraki surumleri silen" hem "yeni surum ekleyen" iki
     * onceki deneme de istenmiyordu). Bir sonraki Kaydet'te upsert() zaten
     * versions tablosundaki GERCEK max'a gore numara uretir (currentVersion'a
     * DEGIL) - boylece checkout SONRASI kaydetmek eski bir versiyon numarasiyla
     * CAKISMAZ.
     */
    @Override
    @Transactional
    public SprintPresentation rollback(Long presentationId, int version, String updatedBySicil) {
        SprintPresentation presentation = getById(presentationId);
        PresentationVersion target = versionRepository.findByPresentationIdAndVersion(presentationId, version)
                .orElseThrow(() -> new NotFoundException("Versiyon bulunamadi: presentationId=" + presentationId + ", version=" + version));

        presentation.setContent(target.getContent());
        presentation.setCurrentVersion(version);
        presentation.setUpdatedBy(updatedBySicil);
        return presentationRepository.save(presentation);
    }

    /**
     * Sunumu "hazir" isaretler / isareti geri alir.
     *
     * Yeni bir SURUM OLUSTURMAZ: bu bir icerik degisikligi degil, bir durum
     * degisikligi. Aksi halde her hazir/geri al tiklamasi surum gecmisini
     * sisirir ve Cagdas Bey'in bakacagi surum listesi anlamsizlasirdi.
     *
     * Zaten ayni durumdaysa hicbir sey yazilmaz - gereksiz updated_at
     * degisikligi olmasin diye (liste "en son guncelleyen" bilgisini gosteriyor).
     */
    @Override
    @Transactional
    public SprintPresentation setFinalized(Long presentationId, boolean finalized, String callerSicil) {
        SprintPresentation presentation = getById(presentationId);
        if (presentation.isFinalized() == finalized) {
            return presentation;
        }
        presentation.setFinalizedAt(finalized ? Instant.now() : null);
        presentation.setFinalizedBy(finalized ? callerSicil : null);
        return presentationRepository.save(presentation);
    }

    @Override
    public List<SprintPresentation> listLatestPerTeamReadOnly(List<Long> teamIds) {
        return presentationRepository.findLatestPerTeamReadOnly(teamIds);
    }

    @Override
    public PresentationDownloadLog recordDownload(PresentationDownloadLog.DownloadType downloadType, List<Long> teamIds, String downloadedBy) {
        return downloadLogRepository.save(new PresentationDownloadLog(null, downloadType, teamIds, downloadedBy, null));
    }
}
