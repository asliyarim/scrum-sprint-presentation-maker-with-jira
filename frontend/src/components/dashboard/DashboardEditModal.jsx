import { useEffect, useState } from "react";
import Modal from "../shared/Modal";
import Button from "../shared/Button";
import { IconEdit, IconCheckCircle, IconRocket, IconPlusCircle } from "../shared/icons";
import { sanitizeDecimalInput, sanitizeIntegerInput, DAV_COLORS, initialsOf, bakimOraniOf, bakimHaricKapasiteOf, VARSAYILAN_BAKIM_ORANI } from "../../lib/format";
import { emptyDashData } from "../../lib/emptyDashData";
import { computeKpisFromPersons } from "../../lib/dashOverride";

const DURUM_OPTIONS = ["Uygun", "Dikkat", "Risk", "Yüksek Risk"];

function emptyPerson() {
  return {
    name: "", role: "", initials: "", avatarUrl: "",
    toplam: 0, tamamlanan: 0, acik: 0, kapasite: 0, doluluk: 0, durum: "Uygun", bakimOrani: null,
  };
}

function num(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Canlı önizlemedeki "Düzenle" ekrani - "⤢ Preview" ile AYNI yerden acilir
 * (bkz. UnifiedPreviewPane), Kapasite Dashboard sekmesindeki HESAPLANMIS
 * veriyi (kisi listesi + KPI'lar) elle duzenlemeye/kisi eklemeye izin verir.
 * TUM takim tiplerinde calisir - Jira kaynakli veri hicbir yerde elle
 * duzenlenemedigi icin (Excel/Manuel'in aksine) en cok bu kaynakta ise yarar.
 * Gorsel tasarim BILEREK duz form kutulari (.bar/.field) yerine kart tabanli
 * (bkz. theme.css ".dashedit-*") - kullanici bildirimi, 2026-08-17: "daha
 * apple tasarımı gibi... normal javascript kutularını falan kullanma".
 *
 * BILEREK gercek work_items/team_members verisini DEGISTIRMEZ - App.jsx'te
 * bir "override" state'ine yazilir, sadece O ANKI sunumun kaydedilecek
 * versiyonuna (buildSaveContent -> dashData) yansir. Veri kaynagi yeniden
 * senkronize edilirse/hesaplanirsa (Jira Yenile, Excel yeniden yukleme, Manuel
 * Hesapla) bu duzenleme otomatik sifirlanir - bkz. kullanici bildirimi,
 * 2026-08-17: "bu değişiklikler sadece versiyon tablosuna kaydedilsin".
 *
 * Henuz hicbir veri kaynagi yuklenmemisken (Excel yuklenmedi, Manuel'de
 * "Hesapla"ya basilmadi, Jira'da "Yenile" yapilmadi - dashData null/kpissiz)
 * eskiden bu modal SESSIZCE hicbir sey acmiyordu (draft null kaldigi icin).
 * Artik bu durumda emptyDashData() ile BOS ama duzenlenebilir bir taslakla
 * acilir - kullanici parametreleri dogrudan buradan girebilir (bkz. kullanici
 * bildirimi, 2026-08-17: "editleye basıldığında boş parametre alma ekranı
 * gelsin").
 */
export default function DashboardEditModal({ open, onClose, dashData, onApply, hasFte = true, teamBakimOrani = VARSAYILAN_BAKIM_ORANI }) {
  // Takimin kayitli bakim/SR orani - satirda kendi orani yoksa (orn. ELLE
  // eklenen yeni bir kisi) taban olarak bu kullanilir. Eskiden 0 kabul
  // ediliyordu: Kapasite % ham kapasiteye bolunuyor (%162 yerine %129) ve
  // Kapasite Farkı bakim dusulmeden hesaplaniyordu (-211,6 yerine -138).
  const oran = teamBakimOrani != null ? Number(teamBakimOrani) : VARSAYILAN_BAKIM_ORANI;
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (open) setDraft(dashData?.kpis ? JSON.parse(JSON.stringify(dashData)) : emptyDashData());
  }, [open, dashData]);

  if (!open || !draft) return null;

  const updateKpi = (key, value) => setDraft((prev) => ({ ...prev, kpis: { ...prev.kpis, [key]: value } }));
  // "Dönem Kapanan" (A/G) ve "Canlıya Alınan FTE" - Jira kaynağında hiçbir
  // yerde elle girilemiyordu (Kapanan otomatik hesaplanır, FTE'yi Jira hiç
  // tutmaz - bkz. JiraDashboardPanel.jsx). Bu ikisi artik SADECE burada
  // duzenlenir (bkz. kullanici bildirimi, 2026-08-17: "canlıya alınan FTE yi
  // buradan çıkart... buraya dönem kapanan AG parametresi almayı da getir") -
  // draft.delta yoksa (henuz previousSnapshotDate girilmemis Excel/Manuel
  // sunumu) burada ilk kez olusturulur, "range" bos kalir (slaytta sadece
  // kapanan/fte doluysa not satirina yazilir - bkz. DashboardSlideCanvas).
  // "kapanan"/"eklenen" duzenlenince "net" alani da SIFIRLANIR (bos birakilir).
  // NEDEN: Jira kaynagi delta.net'i backend'den HAZIR sayiyla getirir
  // (dto.netChange, bkz. useManualDashboard.js toDashData) - format.js'teki
  // Net formulu "d.net bosDEGILSE dogrudan onu kullan, yoksa kapanan-eklenen'i
  // hesapla" mantiginda oldugu icin, eski (backend'den gelen) net dolu
  // kaldigi surece burada girilen YENİ "Dönem Kapanan" degeri HİÇBİR ZAMAN
  // Net'e yansimiyordu (kullanici teyidi 2026-08-20: "net iş yükünü
  // değiştiriyorum jiradan çekincede çalışmıyor"). net'i bosaltmak, ekrandaki
  // Net kartinin YENİ kapanan/eklenen degerlerinden yeniden hesaplanmasini
  // saglar.
  const updateDelta = (key, value) =>
    setDraft((prev) => {
      const nextDelta = {
        ...(prev.delta || { range: "" }),
        [key]: value,
        ...(key === "kapanan" || key === "eklenen" ? { net: "" } : null),
      };
      if (key !== "fte") return { ...prev, delta: nextDelta };
      // "Canlıya Alınan FTE" artik ayrica bir "not satiri" olarak
      // gosterilmiyor (bkz. DashboardSlideCanvas/dashboardDeckBuilder'dan
      // kaldirilan "Canlıya Alınan FTE: X" metni) - kullanici teyidi
      // 2026-08-20: "mavi kutunun içi değişecek toplam FTE o çünkü". Yani bu
      // alana girilen deger DOGRUDAN "Toplam FTE" kartinin (customKpis)
      // GORUNEN degerinin ustune yazar - Excel'den turetilmis veya (Jira
      // kaynaginda oldugu gibi) hic yoksa dahi. Bos birakilirsa elle
      // eklenmis/degistirilmis kart kaldirilir (Excel'den turetilen ORİJİNAL
      // deger draft icinde saklanmadigi icin geri getirilemez - kullanici
      // Excel'i yeniden yukleyerek/Jira'yi yeniden cekerek sifirlayabilir).
      const trimmed = String(value ?? "").trim();
      const existing = prev.customKpis || [];
      const idx = existing.findIndex((k) => k.label === "Toplam FTE");
      const nextCustomKpis =
        trimmed === ""
          ? existing.filter((k) => k.label !== "Toplam FTE")
          : idx >= 0
            ? existing.map((k, i) => (i === idx ? { ...k, value: trimmed } : k))
            : [...existing, { label: "Toplam FTE", value: trimmed, unit: "Elle girildi" }];
      return { ...prev, delta: nextDelta, customKpis: nextCustomKpis };
    });
  const updatePerson = (idx, patch) =>
    setDraft((prev) => ({ ...prev, persons: prev.persons.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  const removePerson = (idx) => setDraft((prev) => ({ ...prev, persons: prev.persons.filter((_, i) => i !== idx) }));
  const addPerson = () => setDraft((prev) => ({ ...prev, persons: [...(prev.persons || []), emptyPerson()] }));

  // "Ek göstergeler" (özel alanlar, orn. RPA'daki "Toplam FTE") - Excel/Jira
  // kaynagindan gelenler de dahil, buradan basligi VE degeri elle
  // degistirilebilsin/silinebilsin/yenisi eklenebilsin diye (kullanici
  // bildirimi 2026-08-24: "kapasite dashboardta özel alanlarda yazan
  // değerleri ve başlıklarını da editleyebilmek istiyorlar"). Manuel Gir'deki
  // customKpis CRUD'unun (bkz. useManualDashboard.js) ayni sekilde bu
  // taslak (draft) uzerinde calisan karsiligi.
  const updateCustomKpi = (idx, patch) =>
    setDraft((prev) => ({ ...prev, customKpis: (prev.customKpis || []).map((k, i) => (i === idx ? { ...k, ...patch } : k)) }));
  const removeCustomKpi = (idx) =>
    setDraft((prev) => ({ ...prev, customKpis: (prev.customKpis || []).filter((_, i) => i !== idx) }));
  const addCustomKpi = () =>
    setDraft((prev) => ({ ...prev, customKpis: [...(prev.customKpis || []), { label: "", value: "", unit: "" }] }));

  // Ekip Özet artik ELLE GIRILMEZ - her render'da kisi satirlarindan yeniden
  // turetilir (bkz. computeKpisFromPersons). "Genel Durum" tek istisnadir:
  // PO'nun sunumda vermek istedigi mesaj her zaman esiklerle birebir
  // ortusmeyebiliyor, o yuzden secilebilir kalir.
  const computedKpis = computeKpisFromPersons(draft.persons, draft.kpis?.durum, oran);

  const handleApply = () => {
    const customKpis = (draft.customKpis || []).filter((k) => k.label.trim() && k.value !== "");
    // Her satira bakim orani ACIKCA yazilir: hem slaytta "(bakım %20)" etiketi
    // gorunsun hem de kayitli sunum bu bilgiyi tasisin (bkz. format.bakimOraniOf
    // - alan bossa oran satirin rakamlarindan turetilmeye calisiliyordu, elle
    // eklenen yeni bir kiside ise turetilecek veri olmadigi icin 0 sayiliyordu).
    const persons = (draft.persons || []).map((p) => ({ ...p, bakimOrani: bakimOraniOf(p, oran) }));
    onApply({ ...draft, persons, kpis: computedKpis, customKpis });
    onClose();
  };

  const kpiTile = (label, key, isPercent = false) => (
    <div className="dashedit-tile dashedit-tile-readonly" key={key}>
      <div className="dashedit-tile-label">{label}</div>
      <input
        readOnly
        tabIndex={-1}
        title="Kişi bazlı satırlardan otomatik hesaplanır"
        value={isPercent ? Math.round((computedKpis[key] || 0) * 100) : Math.round((computedKpis[key] || 0) * 100) / 100}
      />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} boxClassName="box dashedit-box">
      <div className="dashedit-head">
        <span className="dashedit-head-icon">
          <IconEdit style={{ width: 20, height: 20 }} />
        </span>
        <div className="dashedit-head-titles">
          <span className="dashedit-title">Kapasite Dashboard'u Düzenle</span>
          <span className="dashedit-badge">Yalnızca bu sürüme kaydedilir</span>
        </div>
        <button type="button" className="dashedit-close" onClick={onClose} aria-label="Kapat">
          ×
        </button>
      </div>

      <div className="dashedit-body">
        <div className="dashedit-section-label">
          <i /> Ekip özet
        </div>
        <div className="mhint" style={{ margin: "-4px 0 8px" }}>
          Bu değerler aşağıdaki <b>kişi bazlı satırlardan otomatik hesaplanır</b> — elle girilmez, böylece üst
          özet ile alttaki tablo hiçbir zaman birbirinden sapmaz.
        </div>
        <div className="dashedit-kpi-grid">
          {kpiTile("Toplam İş Yükü", "toplam")}
          {kpiTile("Tamamlanan", "tamamlanan")}
          {kpiTile("Açık İş Yükü", "acik")}
          {kpiTile("Kapasite", "kapasite")}
          {kpiTile("Kapasite %", "doluluk", true)}
          {kpiTile("Kapasite Farkı", "acikFazla")}
          <div className="dashedit-tile">
            <div className="dashedit-tile-label">Genel Durum</div>
            <select value={draft.kpis?.durum || "Uygun"} onChange={(e) => updateKpi("durum", e.target.value)}>
              {DURUM_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="dashedit-section-label">
          <i /> Dönem değişimi
        </div>
        <div className="dashedit-kpi-grid">
          <div className="dashedit-tile">
            <div className="dashedit-tile-label">
              <IconCheckCircle className="field-icon" />Dönem Kapanan (A/G)
            </div>
            <input
              inputMode="numeric"
              value={draft.delta?.kapanan ?? ""}
              onChange={(e) => updateDelta("kapanan", sanitizeIntegerInput(e.target.value))}
              placeholder="örn: 37"
            />
          </div>
          <div className="dashedit-tile">
            <div className="dashedit-tile-label">
              <IconPlusCircle className="field-icon" />Yeni Eklenen İş Yükü (A/G)
            </div>
            <input
              inputMode="numeric"
              value={draft.delta?.eklenen ?? ""}
              onChange={(e) => updateDelta("eklenen", sanitizeIntegerInput(e.target.value))}
              placeholder="örn: 12"
            />
          </div>
          {hasFte && (
            <div className="dashedit-tile">
              <div className="dashedit-tile-label">
                <IconRocket className="field-icon" />Canlıya Alınan FTE
              </div>
              <input
                inputMode="decimal"
                value={draft.delta?.fte ?? ""}
                onChange={(e) => updateDelta("fte", sanitizeDecimalInput(e.target.value))}
                placeholder="örn: 0,05 — yoksa boş bırak"
              />
            </div>
          )}
        </div>

        <div className="dashedit-section-label">
          <i /> Kişi bazlı kapasite özeti
        </div>
        <div className="dashedit-persons">
          {(draft.persons || []).map((p, i) => (
            <div className="dashedit-person" key={i} style={{ "--i": i }}>
              <span className="dashedit-avatar" style={{ background: "#" + DAV_COLORS[i % DAV_COLORS.length] }}>
                {initialsOf(p.name)}
              </span>
              <div className="dashedit-identity">
                <input
                  className="dashedit-name"
                  placeholder="Ad Soyad"
                  value={p.name}
                  onChange={(e) => updatePerson(i, { name: e.target.value })}
                />
                <input
                  className="dashedit-role"
                  placeholder="Rol (opsiyonel)"
                  value={p.role || ""}
                  onChange={(e) => updatePerson(i, { role: e.target.value })}
                />
              </div>
              <div className="dashedit-metrics">
                <label className="dashedit-metric">
                  <span>Tamamlanan</span>
                  <input inputMode="decimal" value={p.tamamlanan} onChange={(e) => updatePerson(i, { tamamlanan: num(sanitizeDecimalInput(e.target.value)) })} />
                </label>
                <label className="dashedit-metric">
                  <span>Açık</span>
                  <input
                    inputMode="decimal"
                    value={p.acik}
                    onChange={(e) => {
                      const v = num(sanitizeDecimalInput(e.target.value));
                      // Açık degisince Kapasite % de yeniden hesaplanir -
                      // bkz. Kapasite input'undaki AYNI gerekce. Taban ham
                      // kapasite DEGIL, bakim hariç kapasitedir.
                      const bakimli = bakimHaricKapasiteOf(p, oran);
                      updatePerson(i, { acik: v, doluluk: bakimli > 0 ? v / bakimli : 0 });
                    }}
                  />
                </label>
                <label className="dashedit-metric">
                  <span>Kapasite</span>
                  <input
                    inputMode="decimal"
                    value={p.kapasite}
                    onChange={(e) => {
                      const v = num(sanitizeDecimalInput(e.target.value));
                      // Kapasite elle degistirilince "bakimli" (bakim hariç)
                      // kapasite VE Kapasite % (doluluk = açık/kapasite) AYNI
                      // anda yeniden hesaplanir - yoksa Kapasite Farkı ve
                      // Kapasite % ekrandaki eski (stale) kapasite degerini
                      // kullanmaya devam ederdi (kullanici bildirimi
                      // 2026-08-24: "editlenen bu kapasite değeri
                      // düzenlenince bakımlı doluluk bu değere göre
                      // tekrardan hesaplanmıyor" ve "%122 yazan kapasitenin
                      // güncellenmesi lazımdı güncellenmedi").
                      // Kapasite % HER ZAMAN bakim hariç kapasiteye gore
                      // hesaplanir (Excel'deki "Bakımlı Doluluk" ile ayni
                      // taban) - ham kapasiteye bolunurse PO'nun elle bir
                      // duzeltme yapmasi yuzdeyi oran kadar dusuruyordu
                      // (orn. %159 -> %127, dogrulama 2026-08-25).
                      const kisiOrani = bakimOraniOf(p, oran);
                      const acik = num(p.acik);
                      const bakimli = v * (1 - kisiOrani);
                      updatePerson(i, {
                        kapasite: v,
                        bakimliKapasite: bakimli,
                        doluluk: bakimli > 0 ? acik / bakimli : 0,
                      });
                    }}
                  />
                </label>
                <label className="dashedit-metric">
                  <span>Toplam</span>
                  <input inputMode="decimal" value={p.toplam} onChange={(e) => updatePerson(i, { toplam: num(sanitizeDecimalInput(e.target.value)) })} />
                </label>
                <label className="dashedit-metric">
                  <span>Kapasite %</span>
                  <input
                    inputMode="decimal"
                    value={p.doluluk != null ? Math.round(p.doluluk * 100) : ""}
                    onChange={(e) => updatePerson(i, { doluluk: num(e.target.value) / 100 })}
                  />
                </label>
                <label className="dashedit-metric dashedit-metric-select">
                  <span>Durum</span>
                  <select value={p.durum || "Uygun"} onChange={(e) => updatePerson(i, { durum: e.target.value })}>
                    {DURUM_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className="dashedit-remove" title="Kişiyi sil" onClick={() => removePerson(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="dashedit-add" onClick={addPerson}>
          + Takım üyesi ekle
        </button>

        <div className="dashedit-section-label">
          <i /> Ek göstergeler
        </div>
        <div className="mhint" style={{ margin: "-4px 0 8px" }}>
          Dashboard'ta ekstra kart olarak gösterilen özel alanlar (örn. "Toplam FTE") — başlık ve değerini
          buradan değiştirebilir, yenisini ekleyip silebilirsiniz.
        </div>
        <div className="dashedit-persons">
          {(draft.customKpis || []).map((k, i) => (
            <div className="dashedit-person" key={i} style={{ "--i": i }}>
              <div className="dashedit-metrics">
                <label className="dashedit-metric">
                  <span>Başlık</span>
                  <input placeholder="örn: Toplam FTE" value={k.label} onChange={(e) => updateCustomKpi(i, { label: e.target.value })} />
                </label>
                <label className="dashedit-metric">
                  <span>Değer</span>
                  <input placeholder="örn: 25,7" value={k.value} onChange={(e) => updateCustomKpi(i, { value: e.target.value })} />
                </label>
                <label className="dashedit-metric">
                  <span>Birim / not (opsiyonel)</span>
                  <input placeholder="örn: İş kalemlerinden" value={k.unit || ""} onChange={(e) => updateCustomKpi(i, { unit: e.target.value })} />
                </label>
              </div>
              <button type="button" className="dashedit-remove" title="Göstergeyi sil" onClick={() => removeCustomKpi(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="dashedit-add" onClick={addCustomKpi}>
          + Gösterge ekle
        </button>

        <div className="dashedit-foot">
          <Button variant="soft" onClick={onClose}>Vazgeç</Button>
          <Button onClick={handleApply}>Uygula</Button>
        </div>
      </div>
    </Modal>
  );
}
