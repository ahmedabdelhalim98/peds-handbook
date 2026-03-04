
(() => {
  "use strict";
  try {

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const toast = (msg) => {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.style.display = "none", 1800);
  };

  const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
  const round = (x, d=2) => {
    const p = Math.pow(10,d);
    return Math.round(x*p)/p;
  };

  // Arabic/EN normalization (for fuzzy-ish matching)
  function normAR(s) {
    if (!s) return "";
    s = String(s).toLowerCase().trim();
    // remove tashkeel
    s = s.replace(/[\u064B-\u065F\u0670]/g, "");
    // unify alef
    s = s.replace(/[\u0622\u0623\u0625]/g, "\u0627"); // آأإ → ا
    // ya/aleph maqsura
    s = s.replace(/\u0649/g, "\u064A"); // ى → ي
    // ta marbuta
    s = s.replace(/\u0629/g, "\u0647"); // ة → ه (helps loose matching)
    // hamza forms
    s = s.replace(/[\u0624\u0626]/g, "\u0621"); // ؤ ئ → ء
    // remove tatweel + punctuation
    s = s.replace(/\u0640/g, "");
    s = s.replace(/[\p{P}\p{S}]/gu, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  const DRUG_DB = JSON.parse($("drugDbData").textContent);
  const BONE_ATLAS = JSON.parse($("boneAtlasData").textContent);

  // ---------- Theme ----------
  const THEME_KEY="hb_theme";
  function applyTheme(mode) {
    // Simple: switch bg colors
    if (mode==="light") {
      document.documentElement.style.setProperty("--bg","#f6f8ff");
      document.documentElement.style.setProperty("--text","#0b1220");
      document.documentElement.style.setProperty("--muted","#3c4a6a");
      document.documentElement.style.setProperty("--border","rgba(0,0,0,.12)");
      document.body.style.background="linear-gradient(180deg,#f7fbff 0%, #eef3ff 55%, #f7fbff 100%)";
    } else {
      document.documentElement.style.setProperty("--bg","#0b1220");
      document.documentElement.style.setProperty("--text","#e9eefc");
      document.documentElement.style.setProperty("--muted","#b9c5e6");
      document.documentElement.style.setProperty("--border","rgba(255,255,255,.10)");
      document.body.style.background="";
    }
  }
  let theme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(theme);
  $("themeBtn").addEventListener("click", () => {
    theme = (theme==="dark") ? "light" : "dark";
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  });

  // ---------- Tabs ----------
  const tabs = Array.from(document.querySelectorAll(".tabBtn"));
  const sections = Array.from(document.querySelectorAll("section.tab"));

  function showTab(name, push=true) {
    tabs.forEach(b => b.classList.toggle("active", b.dataset.tab===name));
    sections.forEach(s => s.classList.toggle("hide", s.dataset.tab!==name));
    if (push) history.replaceState(null, "", "#" + name);
    // hide suggests
    $("suggestBox").style.display="none";
    window.scrollTo({top: 0, behavior:"smooth"});
  }
  tabs.forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.querySelectorAll("[data-go]").forEach(el => {
    el.addEventListener("click", () => showTab(el.dataset.go));
  });

  // Load tab from hash
  const hash = (location.hash || "").replace("#","");
  if (hash && sections.some(s => s.dataset.tab===hash)) showTab(hash, false);

  // ---------- Patient context ----------
  const PAT_KEY="hb_patient_v1";
  let patient = (() => {
    try { return JSON.parse(localStorage.getItem(PAT_KEY) || "null"); } catch { return null; }
  })();

  function fmtPatient(p) {
    if (!p) return "لا توجد بيانات محفوظة بعد.";
    const a = (p.age_y!=null) ? (p.age_y + "y") : "—";
    const w = (p.wt!=null) ? (p.wt + "kg") : "—";
    const h = (p.ht!=null) ? (p.ht + "cm") : "—";
    return `Age: ${a} • Wt: ${w} • Ht: ${h}`;
  }

  function refreshPatientUI() {
    $("patientSummary").textContent = fmtPatient(patient);
    if (patient?.wt!=null) $("doseWt").value = patient.wt;
  }
  refreshPatientUI();

  function patientModal() {
    const a = prompt("Age (years)؟", patient?.age_y ?? "");
    if (a===null) return;
    const w = prompt("Weight (kg)؟", patient?.wt ?? "");
    if (w===null) return;
    const h = prompt("Height (cm)؟", patient?.ht ?? "");
    if (h===null) return;
    patient = {
      age_y: a===""? null : Number(a),
      wt: w===""? null : Number(w),
      ht: h===""? null : Number(h),
    };
    localStorage.setItem(PAT_KEY, JSON.stringify(patient));
    refreshPatientUI();
    toast("تم حفظ بيانات المريض");
  }
  $("patientBtn").addEventListener("click", patientModal);
  $("patientBtn2").addEventListener("click", patientModal);

  // ---------- Tricks ----------
  const TRICKS = [
    "لو المريض بيعيّط… ده 50% من التشخيص: هو حي 😄",
    "قبل ما تحسب جرعة… اسأل نفسك: هل الكيلو ده حقيقي ولا تقديري؟",
    "الجرعة الصح = المريض الصح + السياق الصح + double-check.",
    "أبسط إنقاذ للطوارئ: ABCDE… والباقي ييجي وراه.",
    "لو حد قالك 'بس هو صغير'… رد: 'عشان كده محتاج حساب أدق'."
  ];
  function newTrick() {
    $("trickBox").textContent = TRICKS[Math.floor(Math.random()*TRICKS.length)];
  }
  $("newTrick").addEventListener("click", newTrick);
  newTrick();

  // ---------- Vitals cards ----------
  const vitalsData = [
    {k:"Neonate (0–1 mo)", hr:"160–100", rr:"60–40", bp:"60–90 / 30–60"},
    {k:"Infant (1–12 mo)", hr:"150–100", rr:"50–30", bp:"70–100 / 50–65"},
    {k:"Toddler (1–3 y)", hr:"150–90", rr:"40–24", bp:"80–110 / 50–80"},
    {k:"Pre‑school (3–5 y)", hr:"140–80", rr:"34–22", bp:"80–110 / 50–80"},
    {k:"School (6–12 y)", hr:"120–70", rr:"30–18", bp:"90–120 / 55–80"},
    {k:"Adolescent (>12 y)", hr:"100–60", rr:"20–12", bp:"100–130 / 60–85"},
  ];
  const vc = $("vitalsCards");
  vc.innerHTML = vitalsData.map(v => `
    <div class="card">
      <div class="badge">🫀 ${v.k}</div>
      <div class="kpi">${v.hr}</div>
      <div class="kpiSub">HR (bpm)</div>
      <div class="hr"></div>
      <div class="kpi" style="font-size:20px">${v.rr}</div>
      <div class="kpiSub">RR (br/min)</div>
      <div class="hr"></div>
      <div class="small">BP: ${v.bp}</div>
    </div>
  `).join("");

  // Weight estimator (simple APLS-ish: (age+4)*2) for 1–10 years
  $("calcWtBtn").addEventListener("click", () => {
    const age = Number($("ageYears").value);
    if (!isFinite(age) || age<=0) return toast("ادخل عمر صحيح");
    const wt = (age + 4) * 2;
    $("wtResult").textContent = `≈ ${round(wt,1)} kg`;
  });

  // ---------- Drug DB + DoseLab ----------
  // Build searchable strings
  const drugIndex = DRUG_DB.map(d => {
    const names = [d.name?.en, d.name?.ar, ...(d.aliases||[])].filter(Boolean).join(" | ");
    const presets = (d.presets||[]).map(p => p.label).join(" | ");
    return {
      ...d,
      _q: normAR(names + " " + presets)
    };
  });

  let fuse = null;
  function initFuseIfReady() {
    if (fuse || !window.Fuse) return;
    fuse = new window.Fuse(drugIndex, {
      includeScore:true,
      threshold:0.38,
      ignoreLocation:true,
      keys: ["_q"]
    });
  }
  window.addEventListener("load", initFuseIfReady);

  const drugListEl = $("drugList");
  const drugDirEl = $("drugDir");
  const presetRow = $("presetRow");
  const brandSel = $("brandSel");
  const doseTitle = $("doseTitle");
  const doseOut = $("doseOut").querySelector(".resultBig");
  const doseOut2 = $("doseOut2");

  let selectedDrug = null;
  let selectedPreset = null;

  function renderDrugButtons(items) {
    drugListEl.innerHTML = "";
    const take = items.slice(0, 18);
    take.forEach(d => {
      const b = document.createElement("button");
      b.className = "btn";
      b.style.textAlign="right";
      b.textContent = `${d.name.ar || d.name.en} — ${d.name.en || ""}`;
      b.addEventListener("click", () => selectDrug(d.id));
      drugListEl.appendChild(b);
    });
    if (!take.length) {
      drugListEl.innerHTML = `<div class="small">لا نتائج.</div>`;
    }
  }

  function selectDrug(id) {
    selectedDrug = DRUG_DB.find(d => d.id===id) || null;
    selectedPreset = selectedDrug?.presets?.[0] || null;
    doseTitle.textContent = selectedDrug ? `🧾 ${selectedDrug.name.ar || selectedDrug.name.en}` : "🧾 الحساب";
    renderPresets();
    renderBrands();
    calcDose(); // auto-calc if possible
  }

  function renderPresets() {
    presetRow.innerHTML = "";
    if (!selectedDrug) {
      presetRow.innerHTML = `<span class="small">اختر دواء أولاً.</span>`;
      return;
    }
    (selectedDrug.presets||[]).forEach(p => {
      const b = document.createElement("button");
      b.className = "btn " + (p===selectedPreset ? "btnPrimary" : "");
      b.textContent = p.label;
      b.addEventListener("click", () => {
        selectedPreset = p;
        renderPresets();
        calcDose();
      });
      presetRow.appendChild(b);
    });
  }

  function renderBrands() {
    brandSel.innerHTML = "";
    const opts = [];
    opts.push({label:"(بدون اختيار)", value:""});

    (selectedDrug?.brands||[]).forEach((br, idx) => {
      let conc = br.conc_mg_ml ?? br.conc_mcg_ml ?? "";
      const unit = (br.conc_mcg_ml!=null) ? "mcg/mL" : (br.conc_mg_ml!=null ? "mg/mL" : "");
      opts.push({
        label: `${br.name} — ${br.strength}${conc!=="" ? ` • ${conc} ${unit}` : ""}`,
        value: String(idx)
      });
    });

    opts.forEach(o => {
      const op = document.createElement("option");
      op.value = o.value;
      op.textContent = o.label;
      brandSel.appendChild(op);
    });
  }

  function calcDose() {
    if (!selectedDrug || !selectedPreset) {
      doseOut.textContent = "—";
      doseOut2.textContent = "";
      return;
    }

    const wt = Number($("doseWt").value);
    if (!isFinite(wt) || wt<=0) {
      doseOut.textContent = "أدخل الوزن";
      doseOut2.textContent = "";
      return;
    }

    // Override?
    const ovDose = Number($("ovDose").value);
    const ovUnit = $("ovUnit").value.trim();
    const ovConc = Number($("ovConc").value);

    let basis = selectedPreset.basis;
    let unit = selectedPreset.unit;
    let dmin = selectedPreset.dose_min;
    let dmax = selectedPreset.dose_max;

    if (isFinite(ovDose) && ovDose>0 && ovUnit) {
      // Map override unit to basis
      unit = ovUnit;
      if (ovUnit==="mg/kg") basis="per_dose";
      else if (ovUnit==="mg/kg/day") basis="per_day";
      else if (ovUnit==="mcg/kg/min") basis="mcg_kg_min";
      else if (ovUnit==="mL/kg") basis="per_dose_vol";
      dmin = ovDose; dmax = ovDose;
    }

    const showRange = (dmin!=null && dmax!=null && dmin!==dmax);
    const useVal = (showRange) ? (dmin + dmax)/2 : dmin;

    // concentration (from brand)
    let concVal = null;
    const brIdx = brandSel.value;
    if (brIdx!=="" && selectedDrug.brands?.[Number(brIdx)]) {
      const br = selectedDrug.brands[Number(brIdx)];
      concVal = br.conc_mg_ml ?? br.conc_mcg_ml ?? null;
    }
    if (isFinite(ovConc) && ovConc>0) concVal = ovConc;

    let main = "";
    let sub = "";

    if (basis==="per_dose") {
      const mg = wt * useVal;
      const max = selectedPreset.max_mg;
      const mgFinal = (max!=null) ? Math.min(mg, max) : mg;
      main = `${round(mgFinal,2)} mg`;
      if (concVal) {
        const ml = mgFinal / concVal;
        sub = `≈ ${round(ml,2)} mL  (conc ${concVal})`;
      } else {
        sub = "اختر Brand/Concentration لإظهار mL";
      }
    } else if (basis==="per_day") {
      const mgDay = wt * useVal;
      main = `${round(mgDay,2)} mg/day`;
      const freq = selectedPreset.freq_h?.[0] || null;
      if (freq) {
        const dosesPerDay = 24 / freq;
        const perDose = mgDay / dosesPerDay;
        sub = `≈ ${round(perDose,2)} mg كل ${freq} ساعة`;
        if (concVal) sub += ` • ≈ ${round(perDose/concVal,2)} mL/جرعة`;
      } else {
        if (concVal) sub = `conc ${concVal}`;
      }
    } else if (basis==="mcg_kg_min") {
      const mcgMin = wt * useVal;
      const mcgHr = mcgMin * 60;
      main = `${round(mcgMin,2)} mcg/min`;
      sub = `${round(mcgHr,2)} mcg/hr`;
      if (concVal) {
        const mlHr = mcgHr / concVal;
        sub += ` • ≈ ${round(mlHr,2)} mL/hr (conc ${concVal} mcg/mL)`;
      }
    } else if (basis==="mcg_kg") {
      const mcg = wt * useVal;
      main = `${round(mcg,2)} mcg`;
      if (concVal) sub = `≈ ${round(mcg/concVal,2)} mL (conc ${concVal} mcg/mL)`;
    } else if (basis==="per_dose_vol") {
      const ml = wt * useVal;
      main = `${round(ml,2)} mL`;
      sub = selectedPreset.label;
    } else if (basis==="per_dose_range") {
      const mg1 = wt * dmin;
      const mg2 = wt * dmax;
      main = `${round(mg1,2)}–${round(mg2,2)} mg`;
      if (concVal) sub = `≈ ${round(mg1/concVal,2)}–${round(mg2/concVal,2)} mL`;
    } else {
      main = "غير مدعوم";
      sub = "";
    }

    doseOut.textContent = main;
    doseOut2.textContent = sub + (selectedPreset.notes ? ` • ${selectedPreset.notes}` : "");
  }

  $("calcDoseBtn").addEventListener("click", calcDose);
  $("doseWt").addEventListener("input", () => {
    // quick re-calc but avoid too chatty
    clearTimeout(calcDose._t);
    calcDose._t = setTimeout(calcDose, 120);
  });
  brandSel.addEventListener("change", calcDose);
  $("ovDose").addEventListener("input", calcDose);
  $("ovUnit").addEventListener("change", calcDose);
  $("ovConc").addEventListener("input", calcDose);

  $("copyDose").addEventListener("click", async () => {
    try {
      const text = doseOut.textContent + (doseOut2.textContent ? ("\n" + doseOut2.textContent) : "");
      await navigator.clipboard.writeText(text);
      toast("تم النسخ");
    } catch {
      toast("فشل النسخ");
    }
  });

  // Drug directory cards
  function renderDrugDirectory() {
    drugDirEl.innerHTML = DRUG_DB.map(d => {
      const presets = (d.presets||[]).map(p => `• ${p.label}`).join("<br>");
      const brands = (d.brands||[]).slice(0,4).map(b => `• ${b.name} — ${b.strength}`).join("<br>");
      return `
        <div class="card">
          <h4>${d.name.ar || d.name.en}</h4>
          <div class="muted">${d.name.en || ""}</div>
          <div class="hr"></div>
          <div class="small">${presets || "—"}</div>
          <div class="hr"></div>
          <div class="small">${brands ? "<b>Brands:</b><br>"+brands : ""}</div>
          <div class="hr"></div>
          <button class="btn btnPrimary" onclick="window.__selectDrug('${d.id}')">احسب في DoseLab</button>
        </div>
      `;
    }).join("");
  }
  window.__selectDrug = (id) => {
    showTab("doses");
    selectDrug(id);
  };
  renderDrugDirectory();

  // initial drug list
  renderDrugButtons(drugIndex);

  // Drug search
  $("drugSearch").addEventListener("input", (e) => {
    initFuseIfReady();
    const qRaw = e.target.value || "";
    const q = normAR(qRaw);
    if (!q) {
      renderDrugButtons(drugIndex);
      return;
    }
    if (fuse) {
      const res = fuse.search(q).slice(0, 30).map(r => r.item);
      renderDrugButtons(res);
    } else {
      const res = drugIndex.filter(d => d._q.includes(q)).slice(0, 30);
      renderDrugButtons(res);
    }
  });

  // DB modal (simple: copy/export)
  $("dbBtn").addEventListener("click", () => {
    const txt = JSON.stringify(DRUG_DB, null, 2);
    navigator.clipboard.writeText(txt).then(() => toast("تم نسخ JSON")).catch(() => toast("فشل النسخ"));
  });

  // ---------- Emergency & Clinic accordions ----------
  const EMG = [
    {
      t:"Anaphylaxis",
      tag:"Epi + airway",
      b:`IM epinephrine 0.01 mg/kg (1 mg/mL) — repeat 5–10 min PRN • consider fluids/bronchodilator.`
    },
    {
      t:"Status epilepticus",
      tag:"Benzo first",
      b:`Diazepam LD 0.3–0.5 mg/kg; MD 0.1–0.2 mg/kg PRN q2–4h. `
    },
    {
      t:"SVT",
      tag:"Adenosine",
      b:`0.1 mg/kg IV bolus (max 6mg) then 0.2 mg/kg if needed. `
    },
    {
      t:"Shock bolus",
      tag:"NS 0.9%",
      b:`Infant/child: 20 mL/kg over 5 min • Neonate: 10 mL/kg over 10–15 min. `
    }
  ];
  $("emgList").innerHTML = EMG.map(x => `
    <details class="details">
      <summary>
        <div>
          <div class="sumTitle">🚑 ${x.t}</div>
          <div class="sumMeta">${x.tag}</div>
        </div>
        <div>⬇️</div>
      </summary>
      <div class="detailsBody">
        <div class="small">${x.b}</div>
      </div>
    </details>
  `).join("");

  const CLIN = [
    {
      t:"Fever without source",
      tag:"Red flags",
      b:`لو <3 أشهر أو toxic/poor feeding/altered consciousness → تعامل كطوارئ + sepsis workup.`
    },
    {
      t:"Acute otitis media",
      tag:"Antibiotics",
      b:`اختيار المضاد يعتمد على العمر/الشدة/التحسس؛ DoseLab يساعدك في حساب الجرعات بسرعة.`
    },
    {
      t:"Gastroenteritis",
      tag:"ORS focus",
      b:`الأساس: ORS + تقييم الجفاف؛ راقب output والبول.`
    },
  ];
  $("clinicList").innerHTML = CLIN.map(x => `
    <details class="details">
      <summary>
        <div>
          <div class="sumTitle">🏥 ${x.t}</div>
          <div class="sumMeta">${x.tag}</div>
        </div>
        <div>⬇️</div>
      </summary>
      <div class="detailsBody">
        <div class="small">${x.b}</div>
      </div>
    </details>
  `).join("");

  // ---------- Global search (across tabs + drugs + cases) ----------
  // Build global corpus
  const GLOBAL = [];
  function addGlobal(id, label, sub, goTab, action) {
    GLOBAL.push({
      id, label, sub, goTab, action,
      _q: normAR(label + " " + (sub||""))
    });
  }
  // tabs
  [["home","Home"],["vitals","Vitals"],["doses","Doses"],["emergency","Emergency"],["clinic","Clinic"],["picu","PICU"],["nicu","NICU"],["boneage","Bone Age"],["tools","Calculators"],["refs","References"]]
    .forEach(([t,l]) => addGlobal("tab:"+t, l, "tab", t, () => showTab(t)));

  // drugs
  DRUG_DB.forEach(d => {
    addGlobal("drug:"+d.id, d.name.ar || d.name.en, d.name.en || "", "doses", () => window.__selectDrug(d.id));
    (d.aliases||[]).forEach(a => addGlobal("drug_alias:"+d.id+":"+a, a, d.name.ar||d.name.en, "doses", () => window.__selectDrug(d.id)));
  });
  // cases
  EMG.forEach((x,i)=>addGlobal("emg:"+i, x.t, x.tag, "emergency", ()=>showTab("emergency")));
  CLIN.forEach((x,i)=>addGlobal("cl:"+i, x.t, x.tag, "clinic", ()=>showTab("clinic")));

  let globalFuse=null;
  function initGlobalFuse() {
    if (globalFuse || !window.Fuse) return;
    globalFuse = new window.Fuse(GLOBAL, {
      includeScore:true,
      threshold:0.42,
      ignoreLocation:true,
      keys:["_q"]
    });
  }

  const suggestBox = $("suggestBox");
  function showSuggest(items) {
    if (!items.length) {
      suggestBox.style.display="none";
      return;
    }
    suggestBox.innerHTML = items.slice(0,8).map(it => `
      <div class="sItem" data-id="${it.id}">
        <div>${it.label}</div>
        <div class="sSmall">${it.sub || ""}</div>
      </div>
    `).join("");
    suggestBox.style.display="block";
    suggestBox.querySelectorAll(".sItem").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const item = GLOBAL.find(x => x.id===id);
        if (item?.action) item.action();
        suggestBox.style.display="none";
        $("globalSearch").blur();
      });
    });
  }

  $("globalSearch").addEventListener("input", (e) => {
    initGlobalFuse();
    const q = normAR(e.target.value || "");
    if (!q) return showSuggest([]);
    if (globalFuse) {
      showSuggest(globalFuse.search(q).slice(0,8).map(r=>r.item));
    } else {
      showSuggest(GLOBAL.filter(x => x._q.includes(q)).slice(0,8));
    }
  });
  document.addEventListener("click", (e) => {
    if (!suggestBox.contains(e.target) && e.target !== $("globalSearch")) {
      suggestBox.style.display="none";
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==="k") {
      e.preventDefault();
      $("globalSearch").focus();
    }
  });

  // ---------- PICU calculators ----------
  $("calcOI").addEventListener("click", () => {
    const fio2 = Number($("fio2").value);
    const pao2 = Number($("pao2").value);
    const map = Number($("map").value);
    if (![fio2,pao2,map].every(x=>isFinite(x)&&x>0)) return toast("ادخل القيم");
    const pf = pao2 / fio2;
    const oi = (fio2*100*map) / pao2;
    $("oiOut").textContent = `P/F = ${round(pf,1)} • OI = ${round(oi,1)}`;
  });
  $("calcInf").addEventListener("click", () => {
    const w = Number($("infWt").value);
    const d = Number($("infDose").value);
    const c = Number($("infConc").value);
    if (![w,d,c].every(x=>isFinite(x)&&x>0)) return toast("ادخل القيم");
    const mcg_hr = w*d*60;
    const ml_hr = mcg_hr / c;
    $("infOut").textContent = `≈ ${round(ml_hr,2)} mL/hr`;
  });

  // ---------- NICU calculators ----------
  function toUmol(val, unit) {
    if (!isFinite(val)) return NaN;
    return (unit==="mgdl") ? val*17.1 : val;
  }
  const JB_THRESH_MGDL = (h) => {
    // Term infant simplified thresholds (as used in previous version)
    // Phototherapy: >12 at 48h, >15 at 72h, >18 at 96h+
    let photo = 18;
    if (h <= 48) photo = 12;
    else if (h <= 72) photo = 15;
    else photo = 18;
    // Exchange: 20–25 mg/dL (range)
    return { photo_mgdl: photo, exchange_lo_mgdl: 20, exchange_hi_mgdl: 25 };
  };
  $("calcJaundice").addEventListener("click", () => {
    const h = Number($("jbH").value);
    const v = Number($("jbVal").value);
    const u = $("jbUnit").value;
    if (![h,v].every(x=>isFinite(x)&&x>0)) return toast("ادخل القيم");

    // Convert to mg/dL for decisions
    const mgdl = (u==="umol") ? (v/17.1) : v;
    const th = JB_THRESH_MGDL(h);

    let msg = `TSB≈ ${round(mgdl,2)} mg/dL  (≈ ${round(mgdl*17.1,0)} µmol/L) • Photo≥${th.photo_mgdl} • Exchange≈${th.exchange_lo_mgdl}-${th.exchange_hi_mgdl}`;
    if (mgdl >= th.exchange_lo_mgdl) msg += " → ⚠️ Exchange range (راجع البروتوكول فورًا)";
    else if (mgdl >= th.photo_mgdl) msg += " → 🟡 Phototherapy";
    else msg += " → ✅ Below";

    $("jbOut").textContent = msg;
  });
  $("calcGIR").addEventListener("click", () => {
    const D = Number($("girD").value);
    const R = Number($("girR").value);
    if (![D,R].every(x=>isFinite(x)&&x>0)) return toast("ادخل القيم");
    // GIR mg/kg/min = (D% * mL/kg/day * 10) / 1440
    const gir = (D * R * 10) / 1440;
    $("girOut").textContent = `GIR ≈ ${round(gir,2)} mg/kg/min`;
  });

  // ---------- Tools ----------
  $("calcMF").addEventListener("click", () => {
    const w = Number($("mfWt").value);
    if (!isFinite(w) || w<=0) return toast("ادخل وزن");
    let mlhr = 0;
    if (w<=10) mlhr = w*4;
    else if (w<=20) mlhr = 40 + (w-10)*2;
    else mlhr = 60 + (w-20)*1;
    $("mfOut").textContent = `Maintenance ≈ ${round(mlhr,1)} mL/hr`;
  });
  $("calcBSA").addEventListener("click", () => {
    const h = Number($("bsaH").value);
    const w = Number($("bsaW").value);
    if (![h,w].every(x=>isFinite(x)&&x>0)) return toast("ادخل القيم");
    const bsa = Math.sqrt((h*w)/3600);
    $("bsaOut").textContent = `BSA ≈ ${round(bsa,3)} m²`;
  });

  // ---------- Bone age: suggest via similarity ----------
  const baCanvas = $("baCanvas");
  const baCtx = baCanvas.getContext("2d");
  let baImgData = null;

  function drawToCanvas(img) {
    const cw = baCanvas.width, ch = baCanvas.height;
    baCtx.clearRect(0,0,cw,ch);
    // fit image
    const r = Math.min(cw/img.width, ch/img.height);
    const w = img.width*r, h = img.height*r;
    const x = (cw-w)/2, y = (ch-h)/2;
    baCtx.drawImage(img, x, y, w, h);
    baImgData = baCtx.getImageData(0,0,cw,ch);
  }

  function imgDataToVec16(imgData) {
    const size = 16;
    const tmp = document.createElement("canvas");
    tmp.width = size; tmp.height = size;
    const tctx = tmp.getContext("2d", {willReadFrequently:true});
    // draw scaled
    const src = document.createElement("canvas");
    src.width = baCanvas.width; src.height = baCanvas.height;
    src.getContext("2d").putImageData(imgData,0,0);
    tctx.drawImage(src, 0,0,size,size);
    const d = tctx.getImageData(0,0,size,size).data;
    const v = [];
    for (let i=0;i<d.length;i+=4) {
      // luminance
      v.push(Math.round(0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]));
    }
    return v;
  }

  function dist(a,b) {
    let s=0;
    for (let i=0;i<a.length;i++) {
      const d = a[i]-b[i];
      s += d*d;
    }
    return s;
  }

  function formatMonths(m) {
    const y = Math.floor(m/12);
    const mo = m%12;
    if (y===0) return `${mo} mo`;
    if (mo===0) return `${y} y`;
    return `${y} y ${mo} mo`;
  }

  function nearestByAge(sex, months) {
    const list = BONE_ATLAS.filter(x=>x.sex===sex);
    let best = list[0];
    let bestD = Infinity;
    list.forEach(x=>{
      const d = Math.abs(x.age_months - months);
      if (d<bestD) {bestD=d; best=x;}
    });
    return best;
  }

  function updateSliderPreview() {
    const sex = $("baSex").value;
    const m = Number($("baSlider").value);
    const ref = nearestByAge(sex, m);
    $("baSelLabel").textContent = `${formatMonths(ref.age_months)} • ${sex==="M"?"Male":"Female"}`;
    $("baRefImg").src = ref.img;
  }
  $("baSlider").addEventListener("input", updateSliderPreview);
  $("baSex").addEventListener("change", () => {
    updateSliderPreview();
    // if we already have suggestions, clear them
    $("baTop").innerHTML="";
  });
  updateSliderPreview();

  $("baFile").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      drawToCanvas(img);
      URL.revokeObjectURL(url);
      toast("تم تحميل الصورة");
    };
    img.src = url;
  });

  function renderTopCandidates(cands) {
    const box = $("baTop");
    box.innerHTML = cands.map(c => `
      <div class="card" style="padding:10px">
        <div class="badge">⭐ ${c.rank} • ${formatMonths(c.item.age_months)} • ${c.item.sex==="M"?"Male":"Female"}</div>
        <div class="hr"></div>
        <img src="${c.item.img}" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.12)"/>
        <div class="hr"></div>
        <button class="btn btnPrimary" data-pick="${c.item.age_months}">اعتمد هذا</button>
      </div>
    `).join("");

    box.querySelectorAll("[data-pick]").forEach(btn => {
      btn.addEventListener("click", () => {
        const m = Number(btn.dataset.pick);
        $("baSlider").value = String(m);
        updateSliderPreview();
        $("baResult").textContent = `✅ Bone age ≈ ${formatMonths(m)} (selected)`;
      });
    });
  }

  $("baOpenBx").addEventListener("click", () => {
    window.open("https://bxonline.bonexpert.com/select", "_blank");
  });

  $("baSuggest").addEventListener("click", () => {
    if (!baImgData) return toast("ارفع صورة أولاً");
    const sex = $("baSex").value;
    const v = imgDataToVec16(baImgData);

    const pool = BONE_ATLAS.filter(x=>x.sex===sex);
    const scored = pool.map(it => ({it, score: dist(v, it.vec)}))
                      .sort((a,b)=>a.score-b.score)
                      .slice(0,5)
                      .map((x,i)=>({rank:i+1,item:x.it,score:x.score}));

    const best = scored[0]?.item;
    if (best) {
      $("baResult").textContent = `✨ Suggestion: ≈ ${formatMonths(best.age_months)} (top match)`;
      $("baSlider").value = String(best.age_months);
      updateSliderPreview();
    }
    renderTopCandidates(scored);
  });

  } catch (err) {
    console.error(err);
    try { toast("حصل خطأ في الكود — افتح Console"); } catch {}
  }
})();
