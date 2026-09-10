package com.aksa.capacityplanner.presentation.usecase;

import com.aksa.capacityplanner.common.domain.DomainValidationException;
import com.aksa.capacityplanner.presentation.domain.PeriodTeamOrder;
import com.aksa.capacityplanner.presentation.port.in.PeriodOrderUseCase;
import com.aksa.capacityplanner.presentation.port.out.PeriodTeamOrderRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

@Service
public class PeriodOrderService implements PeriodOrderUseCase {

    /** Kazara devasa kayit olusmasin - takim sayisinin cok uzerinde bir tavan. */
    static final int MAKS_TAKIM = 100;

    private final PeriodTeamOrderRepositoryPort repository;

    public PeriodOrderService(PeriodTeamOrderRepositoryPort repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public PeriodTeamOrder setOrder(LocalDate periodEnd, List<Long> teamIds, String callerSicil) {
        if (periodEnd == null) {
            throw new DomainValidationException("Donem tarihi zorunlu.");
        }
        if (teamIds == null || teamIds.isEmpty()) {
            throw new DomainValidationException("Siralama bos olamaz - en az bir takim gerekli.");
        }
        if (teamIds.size() > MAKS_TAKIM) {
            throw new DomainValidationException("Siralamada en fazla " + MAKS_TAKIM + " takim olabilir.");
        }
        // contains(null) KULLANILMAZ: List.of(...) gibi degismez listeler
        // null sorgusuna NullPointerException ile cevap verir, yani null
        // kontrolunun KENDISI patlar. anyMatch her liste turunde calisir.
        if (teamIds.stream().anyMatch(Objects::isNull)) {
            throw new DomainValidationException("Siralamada bos takim olamaz.");
        }
        // Ayni takim iki kez gonderilirse ILK gorunumu korunur; tekrar eden
        // id sirayi belirsiz hale getirirdi (hangi kopya once gelecek?).
        List<Long> tekil = List.copyOf(new LinkedHashSet<>(teamIds));

        return repository.save(new PeriodTeamOrder(periodEnd, tekil, callerSicil, null));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PeriodTeamOrder> listOrders() {
        return repository.findAll();
    }
}
