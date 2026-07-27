/* Blumark24 OS — Executive Dashboard renderer. Renders 100% from the inlined JSON island. */
(function () {
  "use strict";
  var DATA;
  try { DATA = JSON.parse(document.getElementById("dashboard-data").textContent); }
  catch (e) { document.getElementById("app").innerHTML = "<p style='padding:2rem'>تعذّر قراءة البيانات المضمّنة.</p>"; return; }

  var S = DATA.state, GA = DATA.gates, M = DATA.modules, EV = DATA.evidence, H = DATA.history, CH = DATA.checks, LIVE = DATA.live || {};
  var sc = S.scorecard;

  // ---------- helpers ----------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function esc(s) { return String(s == null ? "" : s); }
  var STATE_BADGE = {
    "verified-complete": ["b-ok", "مكتمل موثّق"], "verified-partial": ["b-warn", "جزئي موثّق"],
    "unverified": ["b-mut", "غير موثّق"], "blocked": ["b-bad", "محظور"],
    "stale": ["b-mut", "قديم"], "planned": ["b-plan", "مخطط"], "deferred": ["b-mut", "مؤجل"]
  };
  function stateBadge(state) { var m = STATE_BADGE[state] || ["b-mut", state]; return badge(m[0], m[1]); }
  function badge(cls, text) { return el("span", { class: "badge " + cls }, [el("span", { class: "dot" }), text]); }
  var GATE_BADGE = { complete: ["b-ok", "مكتمل"], partial: ["b-warn", "جزئي"], missing: ["b-bad", "غير موجود"], deferred: ["b-mut", "مؤجل"] };
  function scoreBadge(n) { var c = n >= 85 ? "b-ok" : n >= 60 ? "b-warn" : n >= 30 ? "b-plan" : "b-bad"; return badge(c, n + "/100"); }
  function bar(n) { return el("div", { class: "bar" }, [el("span", { style: "width:" + Math.max(0, Math.min(100, n)) + "%" })]); }
  function kv(pairs) { var d = el("dl", { class: "kv" }); pairs.forEach(function (p) { if (p[1] == null || p[1] === "") return; d.appendChild(el("dt", { text: p[0] })); d.appendChild(el("dd", { text: p[1] })); }); return d; }
  function card(title, hintText, nodes) {
    var c = el("div", { class: "card" });
    if (title) c.appendChild(el("h2", {}, [title]));
    if (hintText) c.appendChild(el("p", { class: "hint" }, [hintText]));
    (nodes || []).forEach(function (n) { c.appendChild(n); });
    return c;
  }
  function tableFrom(headers, rows) {
    var wrap = el("div", { class: "tablewrap" }), t = el("table");
    var thead = el("thead"), htr = el("tr");
    headers.forEach(function (h) { htr.appendChild(el("th", { text: h })); });
    thead.appendChild(htr); t.appendChild(thead);
    var tb = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (cell) { var td = el("td"); if (typeof cell === "string") td.textContent = cell; else if (cell) td.appendChild(cell); tr.appendChild(td); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); return wrap;
  }

  // ---------- section renderers ----------
  function renderOverview() {
    var wrap = el("div");
    // Hero KPIs
    var delta = sc.scoreDelta, dcls = delta === 0 ? "delta-0" : delta > 0 ? "delta-pos" : "delta-neg";
    var pg = sc.productionGate, pgCls = pg.status === "BLOCKED" ? "gate-blocked" : pg.status === "OPEN" ? "gate-open" : "gate-closed";
    var hero = el("div", { class: "hero" });
    function kpi(label, valHtml, sub, accent) { return el("div", { class: "kpi" + (accent ? " accent" : "") }, [el("div", { class: "label", text: label }), el("div", { class: "val", html: valHtml }), sub ? el("div", { class: "sub", html: sub }) : null]); }
    hero.appendChild(kpi("النسبة الحالية الموثّقة", sc.currentVerifiedScore + "<small>/100</small>", "الثقة: " + esc(sc.confidence), true));
    hero.appendChild(kpi("النسبة السابقة", sc.previousScore + "<small>/100</small>", "<span class='" + dcls + "'>Δ " + (delta > 0 ? "+" : "") + delta + "</span>"));
    hero.appendChild(kpi("Production Gate", "<span class='" + pgCls + "'>" + esc(pg.status) + "</span>", esc(pg.reason)));
    hero.appendChild(kpi("جاهزية 10 عملاء", sc.readiness10Clients + "<small>/100</small>", "جاهزية 1000 منشأة: " + sc.readiness1000Orgs));
    wrap.appendChild(hero);

    // Phase + next action strip
    wrap.appendChild(card("المرحلة والخطوة التالية", null, [
      kv([
        ["المرحلة الحالية", sc.currentPhase],
        ["البوابة التالية", sc.nextGate],
        ["المعوّق الحالي", sc.currentBlocker],
        ["الخطوة التالية الوحيدة", sc.nextSingleAction],
        ["آخر تحقق", sc.lastVerified],
        ["حداثة الأدلة", (sc.evidenceFreshness ? sc.evidenceFreshness.label + " — " + (sc.evidenceFreshness.note || "") : "—")]
      ])
    ]));

    // Executive summary
    var es = S.executiveSummary;
    wrap.appendChild(card("الحكم التنفيذي المختصر", null, [
      el("div", { class: "callout", text: es.truth }),
      kv([
        ["المكتمل", es.completed], ["الحالي", es.current], ["التالي", es.next],
        ["أول نتيجة مرئية", es.firstVisibleResult], ["مؤجل", es.deferred], ["غير مؤجل", es.notDeferred],
        ["النطاق", es.scope], ["الهدف", es.goal]
      ]),
      el("div", { class: "callout warn", html: "<b>قاعدة النسبة:</b> " + esc(S.scoringRule) })
    ]));

    // Axes
    var axeNodes = M ? [] : [];
    var axesCard = card("محاور التقييم", "كل محور بدرجته ومصدره — لا متوسطات مزاجية.", []);
    S.axes.forEach(function (a) {
      var row = el("div", { style: "margin:9px 0" }, [
        el("div", { style: "display:flex;align-items:center;gap:10px;flex-wrap:wrap" }, [
          el("b", { text: a.name, style: "flex:1;min-width:140px;font-size:13.5px" }),
          scoreBadge(a.score), el("span", { class: "chip", text: a.source })
        ]),
        bar(a.score)
      ]);
      axesCard.appendChild(row);
    });
    wrap.appendChild(axesCard);
    return wrap;
  }

  function renderClientModules() {
    var wrap = el("div");
    wrap.appendChild(filterBar());
    var intro = card("أقسام لوحة العميل", "كل قسم يُقيّم بست بوابات إثبات؛ الدرجة محسوبة منها (مكتمل=1، جزئي=0.5، غير موجود=0).", []);
    wrap.appendChild(intro);
    var list = el("div", { id: "moduleList" });
    M.clientModules.forEach(function (m) { list.appendChild(moduleAccordion(m)); });
    wrap.appendChild(list);
    return wrap;
  }
  function moduleAccordion(m) {
    var node = el("div", { class: "module", "data-state": m.state, "data-name": m.name });
    var head = el("button", { class: "head", "aria-expanded": "false", onclick: function () { node.classList.toggle("open"); head.setAttribute("aria-expanded", node.classList.contains("open")); } }, [
      el("span", { class: "caret", text: "▸" }),
      el("span", { class: "grow" }, [el("span", { class: "name", text: m.name }), el("span", { class: "path", text: " " + m.path })]),
      scoreBadge(m.score), stateBadge(m.state)
    ]);
    var body = el("div", { class: "body" });
    body.appendChild(el("div", { class: "scoreline" }, [el("b", { text: m.score }), bar(m.score)]));
    var gg = el("div", { class: "gate-grid" });
    M.gateKeys.forEach(function (key) {
      var g = m.gates[key], gb = GATE_BADGE[g] || ["b-mut", g];
      gg.appendChild(el("div", { class: "gate-cell" }, [el("span", { text: M.gateLabels[key] }), badge(gb[0], gb[1])]));
    });
    body.appendChild(gg);
    body.appendChild(kv([
      ["الثقة", m.confidence], ["أكبر نقص", m.biggestGap], ["الخطوة التالية", m.nextAction],
      ["التصميم", m.design], ["تحقق بالكود", m.verifiedInCode ? "نعم" : "—"], ["ملاحظة", m.verifyNote]
    ]));
    node.appendChild(head); node.appendChild(body);
    return node;
  }
  function filterBar() {
    var defs = [["all", "الكل"], ["verified-partial", "جزئي"], ["verified-complete", "مكتمل"], ["blocked", "محظور"], ["planned", "لم يبدأ"], ["deferred", "مؤجل"]];
    var bar = el("div", { class: "filters" });
    defs.forEach(function (d, i) {
      bar.appendChild(el("button", { class: i === 0 ? "active" : "", "data-filter": d[0], onclick: function () {
        bar.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
        this.classList.add("active");
        var f = d[0];
        document.querySelectorAll("#moduleList .module").forEach(function (mod) {
          mod.classList.toggle("hidden", f !== "all" && mod.getAttribute("data-state") !== f);
        });
      } }, [d[1]]));
    });
    return bar;
  }

  function renderOwner() {
    var wrap = el("div");
    wrap.appendChild(card("لوحة مالك المنصة", "منفصلة كليًا عن منشآت العملاء — لا دخول تلقائي لبيانات العميل التشغيلية.", []));
    var rows = M.ownerModules.map(function (o) {
      return [el("b", { text: o.unit }), scoreBadge(o.score), stateBadge(o.state), o.present, o.missing, o.securityNeeded, o.output, el("span", { class: "chip", text: o.priority })];
    });
    wrap.appendChild(card(null, null, [tableFrom(["الوحدة", "التقييم", "الحالة", "الموجود", "الناقص", "أمان مطلوب", "المخرج", "الأولوية"], rows)]));
    return wrap;
  }

  function renderMyDesk() {
    var md = M.clientModules.filter(function (m) { return m.name === "My Desk" || m.name === "المهام"; });
    var wrap = el("div");
    wrap.appendChild(card("My Desk والمكتب الذكي", "دورة المهام تعتمد على Bridge/PR-A/E2E — بوابة 75 → 78.", [
      el("div", { class: "callout warn", text: "المعوّق: Bridge غير مطبّق وغير مختبر حيًا. لا E2E فعلي لمستخدمين ومنشأتين." })
    ]));
    var list = el("div"); md.forEach(function (m) { list.appendChild(moduleAccordion(m)); }); wrap.appendChild(list);
    return wrap;
  }

  function renderHierarchy() {
    var wrap = el("div");
    wrap.appendChild(card("الهيكل الإداري النهائي", "منصة → مدير المنشأة → مجلس → وكالة → إدارة → قسم → موظف (+ سكرتير Capability).", [
      el("div", { class: "flow" }, ["منصة Blumark24 OS", "مدير المنشأة", "مجلس الإدارة", "الوكالة", "الإدارة", "القسم", "الموظف"].reduce(function (acc, t, i, arr) {
        acc.push(el("span", { class: "step", text: t })); if (i < arr.length - 1) acc.push(el("span", { class: "arrow", text: "←" })); return acc;
      }, []))
    ]));
    var rows = M.hierarchy.map(function (h) {
      return [el("b", { text: h.level }), el("span", { class: "chip", text: h.role }), h.scope, h.read, h.write, h.transferPromote, stateBadge(mapHierState(h.state)), h.note];
    });
    wrap.appendChild(card(null, "الهجوم والدفاع أسماء وكالات داخلية لا أدوار عامة. مجلس الإدارة قراءة ورقابة افتراضيًا. السكرتير Capability مفوّضة لا Super Role.", [
      tableFrom(["المستوى", "الدور", "النطاق", "القراءة", "الكتابة", "النقل/الترقية", "الحالة", "ملاحظة"], rows)
    ]));
    return wrap;
  }
  function mapHierState(s) { if (/^موجود$/.test(s)) return "verified-complete"; if (/جزئ/.test(s)) return "verified-partial"; if (/مستقبل/.test(s)) return "planned"; if (/مخطط/.test(s)) return "planned"; return "verified-partial"; }

  function renderAI() {
    var wrap = el("div");
    wrap.appendChild(card("المساعد التنفيذي والسكرتير", "من شات تحليلي إلى عقل تنفيذي وسكرتير آمن — كل طبقة ببوابتها.", [
      el("div", { class: "callout bad", html: "<b>قاعدة غير قابلة للتفاوض:</b> " + esc(M.aiNonNegotiable) }),
      el("div", { class: "flow" }, M.aiMandatoryFlow.reduce(function (acc, t, i, arr) {
        acc.push(el("span", { class: "step", text: t })); if (i < arr.length - 1) acc.push(el("span", { class: "arrow", text: "←" })); return acc;
      }, []))
    ]));
    var rows = M.aiLayers.map(function (a) {
      return [el("b", { text: a.layer }), scoreBadge(a.score), a.state, a.worksNow, a.toBuild, el("span", { class: "chip", text: a.execPermission }), a.approvalGate, a.auditTrail];
    });
    wrap.appendChild(card(null, null, [tableFrom(["الطبقة", "التقييم", "الحالة", "ما يعمل الآن", "ما يجب بناؤه", "صلاحية التنفيذ", "بوابة الموافقة", "سجل التدقيق"], rows)]));
    return wrap;
  }

  function renderSecurity() {
    var wrap = el("div");
    var iso = CH.checks.filter(function (c) { return c.id === "verify:isolation"; })[0];
    wrap.appendChild(card("الأمن والعزل", "العزل الثابت (Static) ناجح؛ العزل الحي (Live) لم يُنفّذ — Client-side filtering لا يُعد حماية.", [
      el("div", { class: "callout" }, [iso ? (iso.result + " — " + iso.note) : "—"]),
      el("div", { class: "callout warn", text: "لا كتابة على Production/Staging. لا apply_migration. لا service_role في مكوّنات العميل (مؤكد بـ verify:isolation)." })
    ]));
    wrap.appendChild(renderRisks());
    return wrap;
  }

  function renderDatabases() {
    var wrap = el("div");
    var fs = LIVE.filesystem || {};
    wrap.appendChild(card("قواعد البيانات — Truth Matrix", "لقطة Supabase الحية لم تُقرأ في جلسة الفحص (read-only، بلا كتابة). لا يُفترض تطابق DB مع الملفات.", [
      kv([["ملفات Migrations (محليًا)", (fs.migrationCount != null ? fs.migrationCount : "—")], ["/meetings route", fs.hasMeetingsRoute ? "موجود" : "غير موجود"]]),
      el("div", { class: "callout warn", html: "<b>Supabase snapshot:</b> " + externalStatus("supabase") })
    ]));
    var rows = [
      ["migrations (files)", "supabase/migrations", "—", "—", "recorded (files)", "—", "—", "—", badge("b-warn", "UNAVAILABLE")],
      ["RLS policies", "sec1/a1 cleanup", "—", "—", "in migrations", "—", "—", "—", badge("b-warn", "لم تُقرأ حيًا")],
      ["Live isolation", "verify:isolation", "static PASS", "—", "—", "—", "—", "—", badge("b-warn", "Live skipped")]
    ].map(function (r) { return r.map(function (c) { return typeof c === "string" ? c : c; }); });
    wrap.appendChild(card("Database Truth Matrix (لقطة محلية)", null, [
      tableFrom(["Object", "Local source", "Preview", "Production", "Migration recorded", "RLS", "Policies", "Data count", "Verdict"], rows)
    ]));
    return wrap;
  }

  function externalStatus(key) {
    var e = (EV.externalSnapshots && EV.externalSnapshots[key]) || {};
    return (e.status || "UNAVAILABLE") + (e.lastChecked ? " — آخر تحقق " + e.lastChecked : " — لم تُقرأ في هذه الجلسة") + (e.detail ? " — " + e.detail : "");
  }
  function renderExternal(key, titleAr) {
    var wrap = el("div");
    wrap.appendChild(card(titleAr, "قراءة فقط. لا نشر يدوي ولا Production deploy. لا كشف أسرار.", [
      el("div", { class: "callout warn", html: "<b>الحالة:</b> " + externalStatus(key) }),
      el("p", { class: "small muted", text: "عند غياب لقطة حديثة تُعرض STALE/UNAVAILABLE ولا يُعاد استخدام نتيجة قديمة كأنها حديثة." })
    ]));
    return wrap;
  }

  function renderTests() {
    var wrap = el("div");
    wrap.appendChild(card("الاختبارات والجودة", "آخر تشغيل: " + esc(CH.lastRun) + " — " + esc(CH.runContext), []));
    var rows = CH.checks.map(function (c) {
      var b = c.result === "PASS" ? badge("b-ok", "PASS") : c.result === "WARN" ? badge("b-warn", "WARN") : c.result === "FAIL" ? badge("b-bad", "FAIL") : badge("b-mut", c.result);
      return [el("b", { text: c.label }), b, c.blocksProduction ? badge("b-bad", "يمنع Production") : badge("b-mut", "لا"), (c.warnings || 0) + "", c.note || c.evidence];
    });
    wrap.appendChild(card(null, null, [tableFrom(["الفحص", "النتيجة", "يمنع Production؟", "تحذيرات", "الدليل/الملاحظة"], rows)]));
    return wrap;
  }

  function renderRisks() {
    var c = card("أخطر المخاطر", "مرتبة حسب الخطورة.", []);
    EV.topRisks.forEach(function (r) {
      var sev = r.severity, cls = sev === "Critical" ? "b-bad" : sev === "High" ? "b-warn" : "b-plan";
      c.appendChild(el("div", { style: "margin:9px 0;padding-bottom:9px;border-bottom:1px solid var(--line-soft)" }, [
        el("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" }, [badge(cls, sev), el("b", { text: r.title }), el("span", { class: "chip", text: r.id })]),
        el("p", { class: "small", style: "margin:5px 0", text: r.detail }),
        el("p", { class: "small muted", html: "<b>التخفيف:</b> " + esc(r.mitigation) })
      ]));
    });
    return c;
  }
  function renderRisksSection() { var w = el("div"); w.appendChild(renderRisks()); w.appendChild(renderGaps()); return w; }
  function renderGaps() {
    var c = card("أكبر الفجوات", "أهم ما يلزم بناؤه.", []);
    var ul = el("ul", { class: "clean" });
    EV.topGaps.forEach(function (g) { ul.appendChild(el("li", {}, [el("span", { class: "chip", text: g.id }), " " + g.title])); });
    c.appendChild(ul); return c;
  }

  function renderPlan() {
    var wrap = el("div");
    wrap.appendChild(card("منهجية البوابات", "لا ترتفع النسبة إلا بإغلاق بوابة موثقة.", [
      el("ul", { class: "clean small" }, GA.methodology.rules.map(function (r) { return el("li", { text: r }); }))
    ]));
    var grows = GA.plan75to100.map(function (p) {
      return [p.order + "", el("b", { text: p.stage }), p.from + " → " + p.to, stateBadge(mapPlanState(p.status)), p.output, p.closeGate, p.currentStep, p.owner];
    });
    wrap.appendChild(card("خطة 75 → 100", "التصميم والجوال مؤجلان للنهاية.", [
      tableFrom(["#", "المرحلة", "من→إلى", "الحالة", "المخرج", "بوابة الإغلاق", "الخطوة الحالية", "المسؤول"], grows)
    ]));
    // gates methodology table
    var gtab = GA.gates.map(function (g) {
      var st = g.state === "closed" ? badge("b-ok", "مغلق") : g.state === "deferred" ? badge("b-mut", "مؤجل") : badge("b-warn", "مفتوح");
      return [g.targetScore + "", el("b", { text: g.stage }), g.status, st, g.gate, g.evidence, g.decision];
    });
    wrap.appendChild(card("بوابات الإثبات", null, [tableFrom(["الدرجة", "المرحلة", "الحالة", "البوابة", "الشرط", "الدليل المطلوب", "القرار"], gtab)]));
    return wrap;
  }
  function mapPlanState(s) { if (/مؤجل/.test(s)) return "deferred"; if (/قيد/.test(s)) return "verified-partial"; if (/لم تبدأ/.test(s)) return "planned"; if (/مكتمل/.test(s)) return "verified-complete"; return "planned"; }

  function renderRoadmap() {
    var wrap = el("div");
    wrap.appendChild(card("خارطة 1000 منشأة", "من أول عميل إلى 1000 منشأة — بوابة انتقال لكل مرحلة.", []));
    var rows = GA.roadmap1000.map(function (r) {
      return [el("b", { text: r.phase }), r.orgs, scoreBadge(r.score), stateBadge(mapPlanState(r.status)), r.productGoal, r.tech, r.kpi, r.transitionGate];
    });
    wrap.appendChild(card(null, null, [tableFrom(["المرحلة", "المنشآت", "التقييم", "الحالة", "هدف المنتج", "التقني", "KPI", "بوابة الانتقال"], rows)]));
    return wrap;
  }

  function renderEvidence() {
    var wrap = el("div");
    wrap.appendChild(card("سجل الأدلة", "مصدر كل تقييم — مع ما يثبته وما لا يثبته وحداثته.", []));
    var rows = EV.evidence.map(function (e) {
      var fb = e.freshness === "fresh" ? badge("b-ok", "حديث") : e.freshness === "stale" ? badge("b-warn", "قديم") : badge("b-mut", "تاريخي");
      return [el("span", { class: "chip", text: e.id }), el("b", { text: e.name }), e.date, e.result, e.proves, e.doesNotProve, e.source, fb];
    });
    wrap.appendChild(card(null, null, [tableFrom(["#", "الدليل", "التاريخ", "النتيجة", "ما يثبت", "ما لا يثبت", "المصدر", "الحداثة"], rows)]));
    return wrap;
  }

  function renderChangelog() {
    var wrap = el("div");
    wrap.appendChild(card("سجل التغييرات", "النسبة تتغير فقط بعد إغلاق بوابة موثقة.", []));
    var rows = H.changelog.map(function (c) {
      var delta = (typeof c.scoreAfter === "number" && typeof c.scoreBefore === "number") ? (c.scoreAfter - c.scoreBefore) : 0;
      return [c.date || "—", el("b", { text: c.phase }), c.event, c.gate, c.scoreBefore + " → " + c.scoreAfter, (delta === 0 ? badge("b-mut", "0") : delta > 0 ? badge("b-ok", "+" + delta) : badge("b-bad", "" + delta)), c.decision];
    });
    wrap.appendChild(card(null, null, [tableFrom(["التاريخ", "المرحلة", "الحدث", "البوابة", "الدرجة", "Δ", "القرار"], rows)]));
    // Live git snapshot
    if (LIVE.git) {
      var g = LIVE.git;
      wrap.appendChild(card("لقطة Git الحية", "تُحدَّث عند تشغيل project:audit.", [
        kv([["الفرع", g.branch], ["HEAD", g.head], ["origin/main", g.originMain], ["متزامن مع origin", g.headMatchesOrigin ? "نعم" : "لا"], ["شجرة العمل", g.clean ? "نظيفة" : "غير نظيفة"], ["diff --check", g.diffCheck], ["مُولّد في", LIVE.generatedAt]])
      ]));
    }
    return wrap;
  }

  // ---------- section registry ----------
  var SECTIONS = [
    { id: "overview", label: "نظرة عامة", ico: "◎", group: null, render: renderOverview },
    { id: "client", label: "أقسام لوحة العميل", ico: "▤", group: "المنتج", render: renderClientModules },
    { id: "owner", label: "لوحة المالك", ico: "♛", group: "المنتج", render: renderOwner },
    { id: "mydesk", label: "My Desk", ico: "🖥", group: "المنتج", render: renderMyDesk },
    { id: "hierarchy", label: "الهيكل الإداري", ico: "⛬", group: "المنتج", render: renderHierarchy },
    { id: "ai", label: "المساعد التنفيذي", ico: "✦", group: "الذكاء", render: renderAI },
    { id: "security", label: "الأمن والعزل", ico: "🛡", group: "الجودة", render: renderSecurity },
    { id: "db", label: "قواعد البيانات", ico: "⛁", group: "الجودة", render: renderDatabases },
    { id: "github", label: "GitHub", ico: "❮❯", group: "الجودة", render: function () { return renderExternal("github", "GitHub"); } },
    { id: "vercel", label: "Vercel", ico: "▲", group: "الجودة", render: function () { return renderExternal("vercel", "Vercel"); } },
    { id: "supabase", label: "Supabase", ico: "⚡", group: "الجودة", render: function () { return renderExternal("supabase", "Supabase"); } },
    { id: "tests", label: "الاختبارات", ico: "✓", group: "الجودة", render: renderTests },
    { id: "risks", label: "المخاطر والفجوات", ico: "⚠", group: "الجودة", render: renderRisksSection },
    { id: "plan", label: "خطة 75–100", ico: "➚", group: "الخطط", render: renderPlan },
    { id: "roadmap", label: "خارطة 1000 منشأة", ico: "🌐", group: "الخطط", render: renderRoadmap },
    { id: "evidence", label: "سجل الأدلة", ico: "▣", group: "السجلات", render: renderEvidence },
    { id: "changelog", label: "سجل التغييرات", ico: "⟲", group: "السجلات", render: renderChangelog }
  ];

  // ---------- shell ----------
  function build() {
    var app = document.getElementById("app");
    app.innerHTML = "";
    var layout = el("div", { class: "layout" });

    var sidebar = el("aside", { class: "sidebar", id: "sidebar" });
    sidebar.appendChild(el("div", { class: "brand" }, [
      el("div", { class: "logo", text: "B" }),
      el("div", {}, [el("b", { text: "Blumark24 OS" }), el("small", { text: "لوحة المتابعة التنفيذية" })])
    ]));
    var nav = el("nav", { class: "nav", "aria-label": "التنقل" });
    var lastGroup = "__";
    SECTIONS.forEach(function (s, i) {
      if (s.group && s.group !== lastGroup) { nav.appendChild(el("div", { class: "group", text: s.group })); lastGroup = s.group; }
      nav.appendChild(el("a", { href: "#" + s.id, "data-sec": s.id, class: i === 0 ? "active" : "", onclick: function (e) { e.preventDefault(); show(s.id); } }, [
        el("span", { class: "ico", text: s.ico }), s.label
      ]));
    });
    sidebar.appendChild(nav);

    var main = el("main", { class: "main", id: "main" });
    var topbar = el("div", { class: "topbar" });
    topbar.appendChild(el("button", { class: "btn mobnav", onclick: toggleNav }, ["☰"]));
    topbar.appendChild(el("h1", { id: "secTitle", text: "نظرة عامة" }));
    topbar.appendChild(el("span", { class: "spacer" }));
    var search = el("div", { class: "searchbox" }, [el("input", { type: "search", id: "search", placeholder: "بحث في اللوحة…", "aria-label": "بحث", oninput: onSearch })]);
    topbar.appendChild(search);
    topbar.appendChild(el("button", { class: "btn", onclick: toggleTheme, title: "تبديل السمة" }, ["◐"]));
    topbar.appendChild(el("button", { class: "btn", onclick: function () { window.print(); } }, ["⎙ طباعة"]));
    topbar.appendChild(el("button", { class: "btn", onclick: exportJson }, ["⇩ JSON"]));
    topbar.appendChild(el("button", { class: "btn primary", onclick: exportMd }, ["⇩ Markdown"]));
    main.appendChild(topbar);

    var meta = el("p", { class: "small muted freshness", id: "freshness" });
    meta.innerHTML = "آخر تحقق: <b>" + esc(sc.lastVerified) + "</b> · حداثة الأدلة: " + esc(sc.evidenceFreshness ? sc.evidenceFreshness.label : "—") + " · بُنيت اللوحة: " + esc(DATA.builtAt || "—") + (LIVE.generatedAt ? " · تدقيق: " + esc(LIVE.generatedAt) : "");
    main.appendChild(meta);

    SECTIONS.forEach(function (s, i) {
      var sec = el("section", { class: "panel" + (i === 0 ? " active" : ""), id: "sec-" + s.id, "data-sec": s.id, tabindex: "-1" });
      main.appendChild(sec);
    });
    layout.appendChild(sidebar); layout.appendChild(main);
    var backdrop = el("div", { class: "backdrop", id: "backdrop", onclick: toggleNav });
    app.appendChild(layout); app.appendChild(backdrop);
    app.removeAttribute("aria-busy");

    // lazy-render each section once
    SECTIONS.forEach(function (s) { var host = document.getElementById("sec-" + s.id); host._render = s.render; });
    renderInto("overview");

    // hash routing
    if (location.hash) { var id = location.hash.slice(1); if (document.getElementById("sec-" + id)) show(id); }
    window.addEventListener("hashchange", function () { var id = location.hash.slice(1); if (document.getElementById("sec-" + id)) show(id); });
  }

  function renderInto(id) {
    var host = document.getElementById("sec-" + id);
    if (host && host._render && !host._done) { host.appendChild(host._render()); host._done = true; }
  }
  function show(id) {
    renderInto(id);
    document.querySelectorAll("#app .panel").forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-sec") === id); });
    document.querySelectorAll(".nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-sec") === id); });
    var s = SECTIONS.filter(function (x) { return x.id === id; })[0];
    if (s) document.getElementById("secTitle").textContent = s.label;
    history.replaceState(null, "", "#" + id);
    var host = document.getElementById("sec-" + id); if (host) host.focus();
    if (window.innerWidth <= 900) closeNav();
    window.scrollTo(0, 0);
  }

  function onSearch(e) {
    var q = e.target.value.trim();
    // render all sections so search spans everything
    if (q) SECTIONS.forEach(function (s) { renderInto(s.id); });
    var lc = q.toLowerCase();
    document.querySelectorAll("#app .panel").forEach(function (p) { p.classList.add("active"); });
    if (!q) { SECTIONS.forEach(function (s, i) { document.getElementById("sec-" + s.id).classList.toggle("active", i === 0 || document.getElementById("sec-" + s.id).getAttribute("data-sec") === currentId()); }); show(currentId()); return; }
    document.querySelectorAll("#app .card, #app .module").forEach(function (n) {
      var hit = n.textContent.toLowerCase().indexOf(lc) !== -1;
      n.classList.toggle("hidden", !hit);
    });
  }
  function currentId() { var a = document.querySelector(".nav a.active"); return a ? a.getAttribute("data-sec") : "overview"; }

  function toggleNav() { document.getElementById("sidebar").classList.toggle("open"); document.getElementById("backdrop").classList.toggle("show"); }
  function closeNav() { document.getElementById("sidebar").classList.remove("open"); document.getElementById("backdrop").classList.remove("show"); }
  function toggleTheme() { var r = document.documentElement; r.setAttribute("data-theme", r.getAttribute("data-theme") === "light" ? "dark" : "light"); }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type }), url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function exportJson() { download("blumark24-dashboard-state.json", JSON.stringify(DATA, null, 2), "application/json"); }
  function exportMd() {
    var L = [];
    L.push("# Blumark24 OS — لوحة المتابعة التنفيذية");
    L.push("");
    L.push("- النسبة الحالية الموثّقة: **" + sc.currentVerifiedScore + "/100** (سابقًا " + sc.previousScore + "، Δ " + sc.scoreDelta + ")");
    L.push("- المرحلة: " + sc.currentPhase);
    L.push("- Production Gate: " + sc.productionGate.status + " — " + sc.productionGate.reason);
    L.push("- المعوّق: " + sc.currentBlocker);
    L.push("- الخطوة التالية: " + sc.nextSingleAction);
    L.push("- آخر تحقق: " + sc.lastVerified);
    L.push("");
    L.push("## أقسام لوحة العميل");
    M.clientModules.forEach(function (m) { L.push("- " + m.name + " (" + m.path + "): " + m.score + "/100 — " + (STATE_BADGE[m.state] ? STATE_BADGE[m.state][1] : m.state) + " — أكبر نقص: " + m.biggestGap); });
    L.push("");
    L.push("## لوحة المالك");
    M.ownerModules.forEach(function (o) { L.push("- " + o.unit + ": " + o.score + "/100 — الناقص: " + o.missing); });
    L.push("");
    L.push("## المساعد التنفيذي");
    M.aiLayers.forEach(function (a) { L.push("- " + a.layer + ": " + a.score + "/100 — " + a.state); });
    L.push("");
    L.push("## أخطر المخاطر");
    EV.topRisks.forEach(function (r) { L.push("- [" + r.severity + "] " + r.title + " — " + r.detail); });
    L.push("");
    L.push("## أكبر الفجوات");
    EV.topGaps.forEach(function (g) { L.push("- " + g.title); });
    L.push("");
    L.push("## الاختبارات");
    CH.checks.forEach(function (c) { L.push("- " + c.label + ": " + c.result + (c.blocksProduction ? " (يمنع Production)" : "")); });
    download("blumark24-dashboard-summary.md", L.join("\n"), "text/markdown");
  }

  build();
})();
