package com.aksa.capacityplanner.presentation.bootstrap;

import com.aksa.capacityplanner.presentation.adapter.out.persistence.SprintPresentationJpaEntity;
import com.aksa.capacityplanner.presentation.adapter.out.persistence.SprintPresentationJpaRepository;
import com.aksa.capacityplanner.presentation.domain.SprintPeriodParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Mevcut sunumlarin donem tarihlerini (period_start/period_end) serbest metin
 * date_range alanindan bir kereligine doldurur - bkz. V34.
 *
 * Neden SQL migration'i degil de Java: date_range Turkce ay adlari iceriyor
 * ("10 Temmuz – 24 Temmuz") ve yil bilgisi cogu kayitta YOK; yil, kaydin
 * olusturulma tarihinden tahmin ediliyor. Bu mantik SprintPeriodParser'da
 * yazili ve test edilmis durumda (uretimdeki 29 gercek deger dahil) - SQL'de
 * yeniden yazmak ikinci ve test edilmemis bir ayristirici demek olurdu.
 *
 * IDEMPOTENT: yalnizca period_start'i NULL olan satirlara dokunur. Her
 * aciliata guvenle calisir; cevrilemeyen kayitlar NULL kalir ve bir sonraki
 * aciliata tekrar denenir (PO tarihi duzeltirse kendiliginden cozulur).
 *
 * SURUM OLUSTURMAZ: bu bir icerik degisikligi degil, var olan bilginin
 * yapilandirilmis hale getirilmesi. content'e dokunulmaz.
 */
@Component
public class PresentationPeriodBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PresentationPeriodBackfill.class);
    private static final ZoneId ISTANBUL = ZoneId.of("Europe/Istanbul");

    private final SprintPresentationJpaRepository repository;

    public PresentationPeriodBackfill(SprintPresentationJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<SprintPresentationJpaEntity> eksikler = repository.findByPeriodStartIsNull();
        if (eksikler.isEmpty()) {
            return;
        }

        int cevrildi = 0;
        List<String> cevrilemeyenler = new ArrayList<>();
        for (SprintPresentationJpaEntity e : eksikler) {
            LocalDate referans = e.getCreatedAt() != null
                    ? LocalDate.ofInstant(e.getCreatedAt(), ISTANBUL)
                    : LocalDate.now(ISTANBUL);
            var donem = SprintPeriodParser.parse(e.getDateRange(), referans);
            if (donem.isPresent()) {
                e.setPeriodStart(donem.get().start());
                e.setPeriodEnd(donem.get().end());
                cevrildi++;
            } else if (e.getDateRange() != null && !e.getDateRange().isBlank()) {
                cevrilemeyenler.add("takim=" + e.getTeamId() + " sprint=" + e.getSprintNo()
                        + " deger=\"" + e.getDateRange() + "\"");
            }
        }
        repository.saveAll(eksikler);

        log.info("Sunum donem tarihleri dolduruldu: {} kayit cevrildi, {} kayit cevrilemedi (toplam {} incelendi).",
                cevrildi, cevrilemeyenler.size(), eksikler.size());
        if (!cevrilemeyenler.isEmpty()) {
            // Bunlar otomatik ortak sunuma GIREMEZ - ilgili ekibin tarihi
            // duzeltmesi gerekiyor. Loglayip gorunur kiliyoruz.
            log.warn("Donem tarihi cevrilemeyen sunumlar (ekiplerin duzeltmesi gerekir): {}",
                    String.join(" | ", cevrilemeyenler));
        }
    }
}
