import { useEffect, useState } from "react";
import Modal from "../shared/Modal";
import Button from "../shared/Button";
import { fetchTeamBenefits, saveTeamBenefits } from "../../lib/apiClient";
import { SEGCOL } from "../../lib/geometry";
import {
  BENEFIT_TYPES, EMPTY_BENEFIT_FORM, benefitFormFromRows, latestBenefitPeriod, benefitEntriesFromForm,
} from "../../lib/benefitForm";

/**
 * "Zaman Dışı Fayda" giriş penceresi — sunum editörünün üst çubuğundan açılır.
 *
 * NEDEN BURADA: kazanımlar önce yalnızca admin ekranından (/admin/kazanimlar)
 * giriliyordu, ama veriyi bilen kişi takımın PO'su. Kullanıcı isteği
 * (2026-09-10): RPA PO'su kendi sunumunu hazırlarken buradan girsin.
 *
 * ADMİN EKRANIYLA AYNI KAYIT: ikisi de aynı uca (PUT /api/teams/{id}/benefits/
 * {period}) yazar, yani ayrı bir eşitlemeye gerek yok — buradan girilen değer
 * admin ekranında da görünür, tersi de geçerli.
 *
 * DIŞ PANO (Nezih) bu kayıtlardan beslenir; slaytın üstündeki görsel çubukla
 * KARIŞTIRILMAMALI - o yalnızca sunumda göstermek için, buradaki veri ise
 * dış panonun kaynağı.
 */
export default function BenefitsModal({ open, onClose, teamId, teamName }) {
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState("");
  const [form, setForm] = useState(EMPTY_BENEFIT_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!open || !teamId) return;
    let iptal = false;
    setLoading(true);
    setError(null);
    setSaved(null);
    fetchTeamBenefits(teamId)
      .then((list) => {
        if (iptal) return;
        const kayitlar = list || [];
        const p = latestBenefitPeriod(kayitlar);
        setRows(kayitlar);
        setPeriod(p);
        setForm(benefitFormFromRows(kayitlar.filter((r) => r.period === p)));
      })
      .catch((err) => { if (!iptal) setError(err?.message || "Kazanımlar yüklenemedi."); })
      .finally(() => { if (!iptal) setLoading(false); });
    return () => { iptal = true; };
  }, [open, teamId]);

  // Donem degisince o donemin kayitli degerleri forma yuklenir; kayit yoksa
  // bos form (yeni donem giriliyor demektir).
  const donemDegisti = (p) => {
    setPeriod(p);
    setSaved(null);
    setForm(benefitFormFromRows(rows.filter((r) => r.period === p.trim())));
  };

  const alanDegisti = (key, alan, deger) => {
    setSaved(null);
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], [alan]: deger } }));
  };

  const kaydet = async () => {
    const p = (period || "").trim();
    if (!p) {
      setError("Dönem boş olamaz (örn. 2026 ya da 2026-Q3).");
      return;
    }
    const { entries, hata } = benefitEntriesFromForm(form);
    if (hata) {
      setError(hata);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const kaydedilen = await saveTeamBenefits(teamId, p, entries);
      setRows((prev) => [...prev.filter((r) => r.period !== p), ...(kaydedilen || [])]);
      setSaved(`${p} dönemi kaydedildi.`);
    } catch (err) {
      setError(err?.message || err?.error || "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const donemler = [...new Set(rows.map((r) => r.period))].sort().reverse();

  return (
    <Modal open={open} onClose={saving ? undefined : onClose}>
      <h3 style={{ marginTop: 0 }}>Zaman Dışı Fayda{teamName ? ` — ${teamName}` : ""}</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Kazanım sağlanan <b>süreç sayılarını</b> girin. Boş bıraktığınız alan &quot;bilinmiyor&quot; olarak
        kaydedilir; <b>0</b> yazarsanız &quot;hiç süreç yok&quot; anlamına gelir — dış panoda bu ikisi
        farklı gösterilir.
      </p>

      <div className="field" style={{ maxWidth: 240, marginBottom: 14 }}>
        <label>Dönem</label>
        <input
          value={period}
          onChange={(e) => donemDegisti(e.target.value)}
          placeholder="2026"
          list="benefit-modal-periods"
        />
        <datalist id="benefit-modal-periods">
          {donemler.map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>

      {loading ? (
        <div className="mhint">Yükleniyor…</div>
      ) : (
                <div className="benefit-liste">
          {BENEFIT_TYPES.map((t) => (
            <div className="benefit-satir" key={t.key}>
              <label className="benefit-satir-ust">
                <span className="dot" style={{ background: "#" + SEGCOL[t.color] }} />
                <span className="benefit-satir-ad">{t.label}</span>
                <input
                  className="benefit-sayi"
                  value={form[t.key]?.processCount ?? ""}
                  inputMode="numeric"
                  placeholder="—"
                  aria-label={t.label + " süreç sayısı"}
                  onChange={(e) => alanDegisti(t.key, "processCount", e.target.value)}
                />
              </label>
              {/* Tutar + para birimi YALNIZCA finansal kazanimda - diger
                  turlerde bu alanlar dis sozlesmede hic yer almiyor. */}
              {t.hasValue && (
                <div className="benefit-satir-tutar">
                  <span className="benefit-satir-tutar-et">Toplam tutar (opsiyonel)</span>
                  <input
                    value={form[t.key]?.value ?? ""}
                    inputMode="decimal"
                    placeholder="—"
                    aria-label="Finansal kazanım tutarı"
                    onChange={(e) => alanDegisti(t.key, "value", e.target.value)}
                  />
                  <input
                    className="benefit-para"
                    value={form[t.key]?.currency ?? "TRY"}
                    maxLength={3}
                    aria-label="Para birimi"
                    onChange={(e) => alanDegisti(t.key, "currency", e.target.value.toUpperCase())}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      {saved && <div className="mhint" style={{ marginTop: 12, color: "var(--aksa-green-dark)" }}>{saved}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <Button variant="soft" onClick={onClose} disabled={saving}>Kapat</Button>
        <Button variant="primary" onClick={kaydet} loading={saving} loadingLabel="Kaydediliyor…" disabled={loading}>
          Kaydet
        </Button>
      </div>
    </Modal>
  );
}
