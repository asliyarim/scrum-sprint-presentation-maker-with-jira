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
 * yüklediği ve kaçının "hazır" işaretlediği görünür; "Bu dönemi seç" tek
 * tuşla o dönemin sunumlarını (her ekipten en güncelini) seçime doldurur.
 *
 * İKİ KADEMELİ AÇILIR (kullanıcı bildirimi 2026-09-10: "bu dönemler kısmı
 * bir tık karmaşık görünüyor"):
 *   1. Panelin kendisi VARSAYILAN KAPALI - ekranı açan kişi önce sunum
 *      seçimini görsün, dönemler isteyene açılsın.
 *   2. Kart dıştan bakınca yalnızca tarih + sayaçlar + "Bu dönemi seç"
 *      gösterir; ekip rozetleri, çakışma uyarısı ve sıralama notu karta
 *      basınca açılır. Bu bilgiler gerekli ama HER ZAMAN gerekli değil.
 *
 * Dönemi backend belirler (bkz. PeriodGrouper). Kaç ekibin sunum yapması
 * GEREKTİĞİ ise burada hesaplanır - takım listesi arayüzde zaten var.
 */
export default function PeriodPanel({ teams, onSelectPeriod, busy = false }) {
  const [periods, setPeriods] = useState(null);
  const [error, setError] = useState(null);
  const [panelAcik, setPanelAcik] = useState(false);
  const [acikDonem, setAcikDonem] = useState(null);

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
  if (!periods || periods.length === 0) return null;

  // Kapali baslikta gorunen ozet - paneli acmaya deger mi, tek bakista belli olsun.
  const tamDonem = toplamTakim > 0
    ? periods.filter((d) => d.takimSayisi === toplamTakim && d.hazirTakimSayisi === toplamTakim).length
    : 0;

  return (
    <div className="bandpanel joint-filter-panel donem-panel" style={{ marginBottom: 16 }}>
      <button
        type="button"
        className="donem-panel-baslik"
        aria-expanded={panelAcik}
        onClick={() => setPanelAcik((a) => !a)}
      >
        <span className="joint-filter-title-badge">
          <IconCalendar style={{ width: 14, height: 14 }} />
        </span>
        <span className="donem-panel-ad">Dönemler</span>
        <span className="donem-panel-ozet">
          {periods.length} dönem
          {tamDonem > 0 && <b> · {tamDonem} tanesinde tüm ekipler hazır</b>}
        </span>
        <span className={"donem-ok" + (panelAcik ? " acik" : "")} aria-hidden="true">›</span>
      </button>

      {panelAcik && (
        <>
          <div className="hint" style={{ margin: "10px 0 12px" }}>
            Sprintler aynı gün bittiği için sunumlar kendiliğinden dönemlere ayrılır. Bir dönemi seçtiğinizde o
            dönemdeki her ekibin <b>en güncel</b> sunumu seçime dolar — sürüm aramanıza gerek yok.
          </div>

          <div className="donem-listesi">
            {periods.map((d) => {
              const eksikler = (teams || []).filter((t) => !d.sunumlar.some((s) => s.teamId === t.id));
              const oran = toplamTakim ? Math.round((d.takimSayisi / toplamTakim) * 100) : 0;
              const tamam = toplamTakim > 0 && d.takimSayisi === toplamTakim;
              const acik = acikDonem === d.bitis;
              return (
                <div key={d.bitis} className={"donem-karti" + (tamam ? " donem-karti-tam" : "")}>
                  {/* DIS YUZ: her zaman gorunen ozet. Karta basmak detayi acar. */}
                  <div
                    className="donem-ozet"
                    role="button"
                    tabIndex={0}
                    aria-expanded={acik}
                    onClick={() => setAcikDonem(acik ? null : d.bitis)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setAcikDonem(acik ? null : d.bitis);
                      }
                    }}
                  >
                    <div className="donem-ozet-sol">
                      <div className="donem-tarih">
                        <IconCalendar style={{ width: 15, height: 15 }} />
                        <b>{isoToTr(d.bitis)}</b>
                        <span className="donem-tarih-not">bitişli dönem</span>
                      </div>
                      <div className="donem-olcum">
                        <span className="donem-rozet">
                          <IconUsers style={{ width: 13, height: 13 }} />
                          {d.takimSayisi}/{toplamTakim || "?"} ekip sunum yükledi
                        </span>
                        <span className={"donem-rozet" + (d.hazirTakimSayisi === d.takimSayisi && d.takimSayisi > 0 ? " donem-rozet-yesil" : "")}>
                          <IconCheckCircle style={{ width: 13, height: 13 }} />
                          {d.hazirTakimSayisi} ekip &quot;hazır&quot; işaretledi
                        </span>
                      </div>
                      <div className="donem-bar">
                        <span className="donem-bar-dolu" style={{ width: oran + "%" }} />
                      </div>
                    </div>
                    <div className="donem-ozet-sag" onClick={(e) => e.stopPropagation()}>
                      <Button variant={tamam ? "primary" : "soft"} disabled={busy} onClick={() => onSelectPeriod(d)}>
                        Bu dönemi seç
                      </Button>
                      <span className={"donem-ok" + (acik ? " acik" : "")} aria-hidden="true">›</span>
                    </div>
                  </div>

                  {/* DETAY: hangi ekipler var, kim eksik, tarih cakismasi, siralama. */}
                  {acik && (
                    <div className="donem-detay">
                      {d.ilkBitis !== d.sonBitis && (
                        <div className="donem-detay-not">
                          Ekipler {isoToTr(d.ilkBitis)} – {isoToTr(d.sonBitis)} arasında bitirdi.
                        </div>
                      )}

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

                      {d.siralayan && (
                        <div className="donem-siralama-notu">
                          Sunuş sırasını en son <b>{d.siralayan}</b> düzenledi
                          {d.siralamaZamani && ` · ${new Date(d.siralamaZamani).toLocaleString("tr-TR", {
                            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}`}
                        </div>
                      )}

                      {/* AYNI EKİPTEN İKİ SUNUM: üretimde Dijital Uygulamalar S10/S11
                          böyle. Sessizce birini seçip geçmiyoruz - hangisinin
                          gireceğini açıkça söylüyoruz ki tarih düzeltilebilsin. */}
                      {d.cakisanTakimlar.length > 0 && (
                        <div className="donem-uyari">
                          {d.cakisanTakimlar.map(takimAdi).join(", ")} bu döneme birden fazla sunum bırakmış —
                          sprint tarihleri çakışıyor. Ortak sunuma <b>en son güncellenen</b> giriyor; doğrusu bu
                          değilse ilgili sprintin tarihini düzeltmek yeterli.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
