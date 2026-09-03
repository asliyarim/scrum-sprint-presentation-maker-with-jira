package com.aksa.capacityplanner.integration.api;

import com.aksa.capacityplanner.integration.api.dto.TeamCapacitySnapshotDto;
import com.aksa.capacityplanner.integration.usecase.CapacitySnapshotService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Dis projeler icin SALT-OKUNUR kapasite ucu.
 *
 * Kimlik dogrulama kullanici cookie'siyle DEGIL, servis anahtariyla yapilir
 * (bkz. ApiKeyAuthFilter) - /api/integration/** yolu bunun icin ayrildi.
 * Mevcut uclarin hicbiri degistirilmedi.
 */
@RestController
@RequestMapping("/api/integration/capacity")
public class CapacityIntegrationController {

    private final CapacitySnapshotService capacitySnapshotService;

    public CapacityIntegrationController(CapacitySnapshotService capacitySnapshotService) {
        this.capacitySnapshotService = capacitySnapshotService;
    }

    /** Tum takimlarin son kaydedilen sunumundaki kapasite ozeti + kisi kirilimi. */
    @GetMapping
    public List<TeamCapacitySnapshotDto> listAll() {
        return capacitySnapshotService.listAll();
    }
}
