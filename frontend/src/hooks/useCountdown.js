import { useEffect, useRef, useState } from "react";

/**
 * Saniye bazlı geri sayım. `active` true olduğunda `totalSeconds`'tan
 * başlar; `active` false olunca durur ve bir sonraki `active=true`'da
 * (veya `totalSeconds` değişince, örn. sıradaki takıma geçilince) sıfırdan
 * başlar. `onExpire`, süre tam 0'a ulaştığı an BİR KEZ çağrılır (örn.
 * sıradaki takıma otomatik geçiş gibi yan etkiler için).
 *
 * `resetKey`: süre AYNI kalsa bile sayacın baştan başlaması gereken
 * durumlar için (örn. ortak sunumda ard arda gelen iki takımın da süresi
 * 5 dk ise `totalSeconds` değişmez; resetKey olarak takım sırası verilir).
 * Verilmezse davranış değişmez.
 */
export function useCountdown(totalSeconds, active, onExpire, resetKey, paused = false) {
  const [remaining, setRemaining] = useState(totalSeconds ?? 0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(totalSeconds ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeconds, active, resetKey]);

  // `paused`: sayaci DURDURUR ama kalan sureyi KORUR (kullanici istegi
  // 2026-09-08, Gözde: "sunumda sure durdur/baslat yapabilir miyiz?").
  // `active`den farki bu: active degisince sure bastan baslar, paused
  // degisince kaldigi yerden devam eder. Bagimli dizide YER ALMAZ, cunku
  // yukaridaki sifirlama efektine girerse duraklat/devam et sureyi sifirlar.
  useEffect(() => {
    if (!active || paused || !totalSeconds || totalSeconds <= 0) return undefined;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          onExpireRef.current?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // resetKey: sure dolunca interval icerideki clearInterval ile duruyor -
    // ayni sureli bir sonraki takima gecilince yeniden kurulmasi icin gerekli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, totalSeconds, resetKey]);

  return remaining;
}

export function formatMmSs(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
