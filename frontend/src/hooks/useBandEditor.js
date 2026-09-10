import { useState } from "react";
import { findBenefitBar, newBenefitBar } from "../lib/benefitTypes";

// Hedefler bandinda gosterilebilecek azami cubuk sayisi - slaytta cok fazla
// cubuk okunabilirligi bozar. Excel/Jira kaynagindan bu sayidan fazla cubuk
// gelirse (bkz. setSample), kullanicidan hangilerini tutacagini secmesi
// istenir (bkz. pendingChoices/BandSelectionModal); manuel eklemede de bu
// sayiya ulasilinca "+ Bar ekle" engellenir (bkz. addBar/error).
export const MAX_BAND_BARS = 3;

function newBar() {
  return { label: "", segments: [{ value: "", color: "green" }, { value: "", color: "blue" }] };
}

export function useBandEditor() {
  const [show, setShow] = useState(false);
  const [bars, setBars] = useState([]);
  const [error, setError] = useState(null);
  // Excel/Jira kaynagi MAX_BAND_BARS'tan fazla cubuk getirdiginde, dogrudan
  // uygulamak yerine burada bekletilir - BandSelectionModal kullaniciya
  // secim yaptirip confirmChoices ile asil bars'a yazar.
  const [pendingChoices, setPendingChoices] = useState(null);

  const toggleShow = (checked) => {
    setShow(checked);
    if (checked && bars.length === 0) setBars([newBar()]);
  };

  const addBar = () => {
    if (bars.length >= MAX_BAND_BARS) {
      setError(`Daha fazla hedef barı ekleyemezsiniz. En fazla ${MAX_BAND_BARS} hedef barı ekleyebilirsiniz.`);
      return;
    }
    setBars((prev) => [...prev, newBar()]);
  };

  /**
   * "Zaman Dışı Fayda" çubuğu - normal çubuklardan farkı, kategorilerinin ve
   * renklerinin SABİT olması; PO yalnızca sayıları yazar (bkz. benefitTypes).
   * Bir sunumda en fazla BİR tane olabilir: iki tane olsaydı dış panonun
   * hangisini okuyacağı belirsiz kalırdı.
   */
  const addBenefitBar = () => {
    if (findBenefitBar(bars)) {
      setError("Zaman dışı fayda çubuğu zaten ekli - bir sunumda yalnızca bir tane olabilir.");
      return;
    }
    if (bars.length >= MAX_BAND_BARS) {
      setError(`Yer kalmadı. En fazla ${MAX_BAND_BARS} çubuk olabilir; önce çubuklardan birini silin.`);
      return;
    }
    setShow(true);
    setBars((prev) => [...prev, newBenefitBar()]);
  };

  const hasBenefitBar = !!findBenefitBar(bars);
  const removeBar = (index) => setBars((prev) => prev.filter((_, i) => i !== index));
  const updateBarLabel = (index, label) =>
    setBars((prev) => prev.map((b, i) => (i === index ? { ...b, label } : b)));

  const addSegment = (barIndex) =>
    setBars((prev) =>
      prev.map((b, i) => (i === barIndex ? { ...b, segments: [...b.segments, { value: "", color: "blue" }] } : b))
    );
  const removeSegment = (barIndex, segIndex) =>
    setBars((prev) =>
      prev.map((b, i) => (i === barIndex ? { ...b, segments: b.segments.filter((_, si) => si !== segIndex) } : b))
    );
  const updateSegment = (barIndex, segIndex, patch) =>
    setBars((prev) =>
      prev.map((b, i) =>
        i === barIndex
          ? { ...b, segments: b.segments.map((s, si) => (si === segIndex ? { ...s, ...patch } : s)) }
          : b
      )
    );

  /** Excel/Jira'dan gelen hazir cubuklari uygular - limit asiliyorsa once secim istenir. */
  const setSample = (sampleBars) => {
    if (sampleBars.length > MAX_BAND_BARS) {
      setPendingChoices(sampleBars);
      return;
    }
    setShow(true);
    setBars(sampleBars);
  };

  const confirmChoices = (selectedBars) => {
    setShow(true);
    setBars(selectedBars);
    setPendingChoices(null);
  };
  const cancelChoices = () => setPendingChoices(null);
  const clearError = () => setError(null);

  return {
    show, bars, toggleShow, addBar, removeBar, updateBarLabel, addSegment, removeSegment, updateSegment, setSample,
    error, clearError, pendingChoices, confirmChoices, cancelChoices,
    addBenefitBar, hasBenefitBar,
  };
}
