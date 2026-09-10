package com.aksa.capacityplanner.presentation.api.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** Donem siralama istegi - takim id'lerinin SIRALI listesi. */
public record PresentationPeriodOrderRequest(@NotEmpty(message = "Siralama bos olamaz.") List<Long> teamIds) {
}
