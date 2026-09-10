import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import { IconCalendar, IconCheckCircle, IconUsers } from "./icons";
import { fetchPresentationPeriods } from "../../lib/apiClient";
import { isoToTr } from "../../lib/sprintPeriod";

/**
 * DÖNEM PANELİ — otomatik ortak sunumun ekran karşılığı.
 *
 * Gözde'nin isteği (2026-09-09): "Çağdaş Bey sürekli hangisi yeni versiyon
 * diye aramak zorunda kalmasın." Burada tarih tarih hangi ekiplerin sunum
 * yüklediği ve kaçının "hazır" işaretlediği tek bakışta görünür; "Bu dönemi
 * seç" tek tuşla o dönemin sunumlarını (her ekipten en güncelini) ortak sunum
 * seçimine doldurur.
 *
 * Dönemi backend belirler (bkz. PeriodGrouper): sprintler AYNI GÜN bitiyor,
 * gruplama bitiş tarihine ±3 gün toleransla yapılıyor. Kaç ekibin sunum
 * yapması GEREKTİĞİ ise burada hesaplanır — takım listesi arayüzde zaten var,
 * sunum modülünün takım modülüne bağlanmasına gerek yok.
 */
export default function PeriodPanel({ teams, onSelectPeriod, busy = false }) {
  const [periods, setPeriods] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const rows = await fetchPresentationPeriods();
        if (!iptal) setPeriods(rows);
      } catch {
        if (!iptal) setError("Dönemler yüklenemedi.");
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  const takimAdi = useMemo(() => {
    const m = new Map((teams || []).map((t) => [t.id, t.name]));
    return (id) => m.get(id) || `Takım ${id}`;
  }, [teams]);

  const toplamTakim = (teams || []).length;

  if (error) return <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>;
  if (!periods) return <div className="mhint" style={{ marginBottom: 16 }}>Dönemler yükleniyor…</div>;
  if (periods.length === 0) return null;

  return (
    <div className="bandpanel joint-filter-panel" style={{ marginBottom: 16 }}>
      <div className="bandtoggle joint-filter-title" style={{ cursor: "default" }}>
        <span className="joint-filter-title-badge">
          <IconCalendar style={{ width: 14, height: 14 }} />
        </span>
        Dönemler
      </div>
      <div className="hint" style={{ margin: "0 0 12px" }}>
        Sprintler aynı gün bittiği için sunumlar kendiliğinden dönemlere ayrılır. Bir dönemi seçtiğinizde o
        dönemdeki her ekibin <b>en güncel</b> sunumu seçime dolar — sürüm aramanıza gerek yok.
      </div>

      <div className="donem-listesi">
        {periods.map((d) => {
          const eksikler = (teams || []).filter((t) => !d.sunumlar.some((s) => s.teamId === t.id));
          const oran = toplamTakim ? Math.round((d.takimSayisi / toplamTakim) * 100) : 0;
          const tamam = toplamTakim > 0 && d.takimSayisi === toplamTakim;
          return (
            <div key={d.bitis} className={"donem-karti" + (tamam ? " donem-karti-tam" : "")}>
              <div className="donem-ust">
                <div className="donem-tarih">
                  <IconCalendar style={{ width: 15, height: 15 }} />
                  <b>{isoToTr(d.bitis)}</b>
                  <span className="donem-tarih-not">
                    bitişli dönem
                    {/* Ekipler hep aynı gün bitirmiyor - biri bir iki gün sarkabiliyor.
                        Dönemin adı en çok ekibin bitirdiği gün, ama gerçek yayılımı da
                        söylüyoruz ki "benim sprintim 7'sinde bitti, niye 3 yazıyor"
                        sorusu doğmasın. */}
                    {d.ilkBitis !== d.sonBitis && (
                      <> · ekipler {isoToTr(d.ilkBitis)} – {isoToTr(d.sonBitis)} arasında bitirdi</>
                    )}
                  </span>
                </div>
                <Button
                  variant={tamam ? "primary" : "soft"}
                  disabled={busy}
                  onClick={() => onSelectPeriod(d)}
                >
                  Bu dönemi seç
                </Button>
              </div>

              <div className="donem-olcum">
                <span className="donem-rozet">
                  <IconUsers style={{ width: 13, height: 13 }} />
                  {d.takimSayisi}/{toplamTakim || "?"} ekip sunum yükledi
                </span>
                <span className={"donem-rozet" + (d.hazirTakimSayisi === d.takimSayisi && d.takimSayisi > 0 ? " donem-rozet-yesil" : "")}>
                  <IconCheckCircle style={{ width: 13, height: 13 }} />
                  {d.hazirTakimSayisi} ekip "hazır" işaretledi
                </span>
              </div>

              <div className="donem-bar">
                <span className="donem-bar-dolu" style={{ width: oran + "%" }} />
              </div>

              <div className="donem-takimlar">
                {d.sunumlar.map((s) => (
                  <span
                    key={s.id}
                    className={"donem-cip" + (s.finalizedAt ? " donem-cip-hazir" : "")}
                    title={s.finalizedAt ? "Hazır işaretlendi" : "Henüz hazır işaretlenmedi"}
                  >
                    {takimAdi(s.teamId)} · S{s.sprintNo}
                  </span>
                ))}
                {eksikler.map((t) => (
                  <span key={"eksik-" + t.id} className="donem-cip donem-cip-eksik" title="Bu dönemde sunumu yok">
                    {t.name}
                  </span>
                ))}
              </div>

              {/* AYNI EKİPTEN İKİ SUNUM: üretimde Dijital Uygulamalar S10/S11
                  böyle (iki sprint neredeyse aynı günleri kapsıyor). Sessizce
                  birini seçip geçmiyoruz - hangisinin gireceğini açıkça
                  söylüyoruz ki tarih düzeltilebilsin. */}
              {/* Sıralamayı en son kim yaptıysa o geçerli (Gözde'nin 4. maddesi).
                  Kimin değiştirdiğini göstermek, "benim sıralamam nerede"
                  sorusunun cevabını ekranda tutuyor. */}
              {d.siralayan && (
                <div className="donem-siralama-notu">
                  Sunuş sırasını en son <b>{d.siralayan}</b> düzenledi
                  {d.siralamaZamani && ` · ${new Date(d.siralamaZamani).toLocaleString("tr-TR", {
                    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}`}
                </div>
              )}

              {d.cakisanTakimlar.length > 0 && (
                <div className="donem-uyari">
                  {d.cakisanTakimlar.map(takimAdi).join(", ")} bu döneme birden fazla sunum bırakmış —
                  sprint tarihleri çakışıyor. Ortak sunuma <b>en son güncellenen</b> giriyor; doğrusu bu
                  değilse ilgili sprintin tarihini düzeltmek yeterli.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
