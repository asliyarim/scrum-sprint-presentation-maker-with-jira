package com.aksa.capacityplanner.common.domain;

/**
 * Bir kaynak, benzersizlik kisitini ihlal edecek sekilde degistirilmeye
 * calisildiginda firlatilir - HTTP 409. Ornek: bir sunumun sprint numarasi,
 * ayni takimda ZATEN VAR OLAN baska bir sprint numarasina degistirilmek
 * istendiginde (bkz. PresentationService.upsert, kullanici bildirimi
 * 2026-09-01: "her düzenleme yaptigimda kaydet dedigimde cokluyor").
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
