/* Electricity price tool for gia-dien/ and en/electricity-prices/.
 *
 * One file for both languages: the language comes from <html lang>. Tariff data lives here.
 * After changing G, run `npm run prerender` so the tariff view written into both pages'
 * HTML (for search engines and visitors without JavaScript) matches.
 * Outside a browser the pure render functions are exposed instead of touching the DOM.
 */
(function (root) {
  "use strict";

  /* ================= DATA =================
     tou rows: [normal, off-peak, peak] in VND/kWh excl. VAT
     cur = QĐ 2892/QĐ-BCT (01/11/2026); y2025 = QĐ 1279/QĐ-BCT (10/05/2025); y2024 = QĐ 2699/QĐ-BCT (11/10/2024)
     Voltage levels were restructured on 01/11/2026; old values use the closest previous level (noted in oldLv). */
  var INF = Infinity;
  var G = {
    residential: { kind: "tier",
      cur: [[100, 1901], [200, 2289], [400, 2894], [700, 3456], [INF, 3844]],
      y2025: [[50, 1984], [100, 2050], [200, 2380], [300, 2998], [400, 3350], [INF, 3460]],
      y2024: [[50, 1893], [100, 1956], [200, 2271], [300, 2860], [400, 3197], [INF, 3302]] },
    commercial: { kind: "tou", def: "lv", prof: "dayEve", rows: [
      { id: "lv", cur: [3089, 1880, 5313], y2025: [3152, 1918, 5422], y2024: [3007, 1830, 5174], oldLv: { vi: "dưới 6 kV", en: "under 6 kV" } },
      { id: "mv", cur: [2829, 1577, 4924], y2025: [2887, 1609, 5025], y2024: [2755, 1535, 4795], oldLv: { vi: "từ 22 kV", en: "22 kV and above" } }] },
    hotel: { kind: "tou", def: "lv", prof: "h24", rows: [
      { id: "lv", cur: [1966, 1274, 3586], y2025: [3152, 1918, 5422], y2024: [3007, 1830, 5174], oldLv: { vi: "giá kinh doanh dưới 6 kV", en: "commercial rate, under 6 kV" } },
      { id: "mv", cur: [1814, 1166, 3348], y2025: [2887, 1609, 5025], y2024: [2755, 1535, 4795], oldLv: { vi: "giá kinh doanh từ 22 kV", en: "commercial rate, 22 kV and above" } }] },
    manufacturing: { kind: "tou", def: "mv", prof: "day", rows: [
      { id: "lv", cur: [1966, 1274, 3586], y2025: [1987, 1300, 3640], y2024: [1896, 1241, 3474], oldLv: { vi: "dưới 6 kV", en: "under 6 kV" } },
      { id: "mv", cur: [1814, 1166, 3348], y2025: [1833, 1190, 3398], y2024: [1749, 1136, 3242], oldLv: { vi: "22 kV đến dưới 110 kV", en: "22 kV to under 110 kV" } },
      { id: "hv", cur: [1792, 1123, 3218], y2025: [1811, 1146, 3266], y2024: [1728, 1094, 3116], oldLv: { vi: "từ 110 kV", en: "110 kV and above" } },
      { id: "ehv", cur: [1771, 1101, 3110], y2025: [1811, 1146, 3266], y2024: [1728, 1094, 3116], oldLv: { vi: "từ 110 kV", en: "110 kV and above" } }] }
  };
  var VOLT = {
    lv: { vi: "Hạ áp (đến 1 kV)", en: "Low voltage (up to 1 kV)" },
    mv: { vi: "Trung áp (trên 1 kV đến 35 kV)", en: "Medium voltage (1–35 kV)" },
    hv: { vi: "Cao áp (trên 35 kV đến dưới 220 kV)", en: "High voltage (35–220 kV)" },
    ehv: { vi: "Từ 220 kV trở lên", en: "220 kV and above" },
    mvC: { vi: "Trung áp trở lên (trên 1 kV)", en: "Medium voltage and above (over 1 kV)" }
  };
  var GN = {
    residential: { vi: "Hộ gia đình", en: "Households", who: { vi: "Nhà ở, căn hộ", en: "Homes and apartments" } },
    commercial: { vi: "Kinh doanh", en: "Commercial", who: { vi: "Cửa hàng, văn phòng, nhà hàng, quán cà phê", en: "Shops, offices, restaurants, cafés" } },
    hotel: { vi: "Khách sạn, lưu trú", en: "Hotels & lodging", who: { vi: "Khách sạn, resort, homestay", en: "Hotels, resorts, homestays" } },
    manufacturing: { vi: "Sản xuất", en: "Manufacturing", who: { vi: "Nhà máy, xưởng sản xuất", en: "Factories and workshops" } }
  };
  /* share of kWh by band: p=peak, o=off-peak, rest normal */
  var PROF = {
    day: { p: .08, o: .05, vi: "Chủ yếu ban ngày", en: "Mostly daytime" },
    dayEve: { p: .25, o: .08, vi: "Ban ngày và buổi tối", en: "Daytime and evening" },
    h24: { p: .21, o: .25, vi: "Hoạt động 24/7", en: "Open 24/7" }
  };
  /* Conservative on purpose: SmartSolar's discount starts at 15% (case studies show up to 30%). */
  var PPA_DISC = .15, SOLAR_SHARE = .30, KWH_PER_KWP_MONTH = 120;
  var GROUPS = ["residential", "commercial", "hotel", "manufacturing"];
  /* figures quoted in the text, derived from G so a tariff update keeps them right */
  var RES_MIN = G.residential.cur[0][1], RES_MAX = G.residential.cur[G.residential.cur.length - 1][1];
  var HOTEL_OLD = G.hotel.rows[0].y2025[0], HOTEL_NEW = G.hotel.rows[0].cur[0];
  function hotelDrop() { return nf(Math.round((HOTEL_OLD - HOTEL_NEW) / HOTEL_OLD * 100)) + "%"; }

  /* ================= HELPERS ================= */
  var lang = "vi";
  function setLang(l) { lang = l === "en" ? "en" : "vi"; }
  function L(o) { return o[lang]; }
  function tx(vi, en) { return lang === "vi" ? vi : en; }
  function nf(n, d) {
    return new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US",
      { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(n);
  }
  function unit() { return tx("đ/kWh", "VND/kWh"); }
  function money(n) {
    var a = Math.abs(n);
    if (a >= 1e9) return nf(n / 1e9, 2) + tx(" tỷ đ", " bn VND");
    if (a >= 1e7) return nf(n / 1e6, 1) + tx(" triệu đ", "m VND");
    return nf(Math.round(n)) + tx(" đ", " VND");
  }
  function chg(cur, old) {
    if (!old || !isFinite(old) || !isFinite(cur)) return { p: 0, s: "–", cls: "" };
    var p = (cur - old) / old * 100, r = Math.abs(p) < .05 ? 0 : p;
    return { p: r, s: (r > 0 ? "+" : r < 0 ? "−" : "±") + nf(Math.abs(r), 1) + "%", cls: r > 0 ? "up" : r < 0 ? "down" : "" };
  }
  function tierBill(tiers, kwh) {
    var b = 0, prev = 0;
    for (var i = 0; i < tiers.length; i++) {
      var cap = tiers[i][0]; if (kwh <= prev) break;
      b += (Math.min(kwh, cap) - prev) * tiers[i][1]; prev = cap;
    }
    return b;
  }
  function tierKwh(tiers, bill) {
    var k = 0, prev = 0;
    for (var i = 0; i < tiers.length; i++) {
      var cap = tiers[i][0], rate = tiers[i][1], q = cap - prev, c = q * rate;
      if (bill <= c || cap === INF) return k + bill / rate;
      bill -= c; k += q; prev = cap;
    }
    return k;
  }
  function rowOf(g, id) { var r = G[g].rows; for (var i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return r[0]; }
  function voltLabel(g, id) { return (g !== "manufacturing" && id === "mv") ? L(VOLT.mvC) : L(VOLT[id]); }
  function blend(r, prof) { var P = PROF[prof]; return r[1] * P.o + r[2] * P.p + r[0] * (1 - P.o - P.p); }
  function sw(band) { return "<span class='sw sw-" + band + "' aria-hidden='true'></span>"; }

  /* ================= PURE RENDERERS (also used by the build) ================= */
  function groupsHTML(group) {
    return GROUPS.map(function (g) {
      var price, u, chip, cls;
      if (g === "residential") {
        price = nf(RES_MIN) + "–" + nf(RES_MAX); u = tx("đ/kWh · 5 bậc", "VND/kWh · 5 tiers"); chip = tx("Biểu 5 bậc mới", "New 5-tier scale"); cls = "";
      } else {
        var r = rowOf(g, "lv"), c = chg(r.cur[0], r.y2025[0]);
        price = nf(r.cur[0]); u = tx("đ/kWh · giờ bình thường, hạ áp", "VND/kWh · normal hours, low voltage");
        chip = c.s + " " + tx("so với 05/2025", "vs May 2025"); cls = c.cls;
      }
      return "<button type='button' class='gcard' data-g='" + g + "' aria-pressed='" + (g === group) + "'><span class='gname'>" + L(GN[g]) +
        "</span><span class='gwho'>" + L(GN[g].who) + "</span><span class='gprice'>" + price + "</span><span class='gunit'>" + u +
        "</span><span class='gchip " + cls + "'>" + chip + "</span></button>";
    }).join("");
  }

  function cell(cur, old, yr) {
    if (!old) return "<span class='v'>" + nf(cur) + "</span>";
    var c = chg(cur, old);
    return "<span class='v'>" + nf(cur) + "</span><span class='was'>" + yr + ": " + nf(old) + " · <b class='" + c.cls + "'>" + c.s + "</b></span>";
  }

  function tariffParts(group, cmp) {
    var g = G[group], notes = "", h;
    var yrLbl = cmp === "y2025" ? tx("05/2025", "May 2025") : tx("10/2024", "Oct 2024");
    var title = L(GN[group]) + tx(": giá từ 01/11/2026", ": prices from 1 Nov 2026");
    if (g.kind === "tier") {
      if (cmp === "none") {
        var lbls = [tx("Bậc 1: đến 100 kWh", "Tier 1: up to 100 kWh"), tx("Bậc 2: 101–200 kWh", "Tier 2: 101–200 kWh"), tx("Bậc 3: 201–400 kWh", "Tier 3: 201–400 kWh"), tx("Bậc 4: 401–700 kWh", "Tier 4: 401–700 kWh"), tx("Bậc 5: từ 701 kWh", "Tier 5: 701 kWh and up")];
        h = "<thead><tr><th>" + tx("Bậc", "Tier") + "</th><th>" + tx("Giá", "Price") + " (" + unit() + ")</th></tr></thead><tbody>";
        g.cur.forEach(function (r, i) { h += "<tr><td class='k'>" + lbls[i] + "</td><td><span class='v'>" + nf(r[1]) + "</span></td></tr>"; });
        notes = "<div class='callout'>" + tx("Từ 01/11/2026, biểu giá sinh hoạt rút từ 6 bậc xuống 5 bậc. Phần lớn hộ gia đình trả ít hơn, nhưng hộ dùng trên khoảng 1.000 kWh/tháng có thể trả nhiều hơn vì bậc cao nhất tăng lên " + nf(RES_MAX) + " đ/kWh.", "From 1 Nov 2026 the residential scale moved from 6 tiers to 5. Most households pay less, but homes using more than about 1,000 kWh a month can pay more because the top tier rose to " + nf(RES_MAX) + " VND/kWh.") + "</div>";
      } else {
        var old = g[cmp];
        h = "<thead><tr><th>" + tx("Điện dùng mỗi tháng", "Monthly usage") + "</th><th>" + tx("Tiền điện hiện nay", "Bill now") + "</th><th>" + tx("Tiền điện ", "Bill in ") + yrLbl + "</th><th>" + tx("Thay đổi", "Change") + "</th></tr></thead><tbody>";
        [100, 200, 400, 700, 1000, 1500].forEach(function (k) {
          var a = tierBill(g.cur, k), b = tierBill(old, k), c = chg(a, b);
          h += "<tr><td class='k'>" + nf(k) + " kWh</td><td><span class='v'>" + money(a) + "</span></td><td>" + money(b) + "</td><td class='" + c.cls + "'><b>" + c.s + "</b></td></tr>";
        });
        notes = "<div class='callout'>" + tx("Biểu bậc thang đã thay đổi cấu trúc nên chúng tôi so sánh theo tổng tiền điện ở cùng mức sử dụng (chưa VAT).", "The tier structure changed, so we compare total bills at the same usage (excl. VAT).") + "</div>";
      }
    } else {
      h = "<thead><tr><th>" + tx("Cấp điện áp", "Voltage level") + "</th><th>" + sw("off") + tx("Thấp điểm", "Off-peak") + "</th><th>" + sw("normal") + tx("Bình thường", "Normal") + "</th><th>" + sw("peak") + tx("Cao điểm", "Peak") + "</th></tr></thead><tbody>";
      g.rows.forEach(function (r) {
        var o = cmp === "none" ? null : r[cmp];
        h += "<tr><td class='k'>" + voltLabel(group, r.id) + (o ? "<span class='was'>" + tx("So với mức cũ: ", "Compared with old level: ") + L(r.oldLv) + "</span>" : "") +
          "</td><td>" + cell(r.cur[1], o && o[1], yrLbl) + "</td><td>" + cell(r.cur[0], o && o[0], yrLbl) + "</td><td>" + cell(r.cur[2], o && o[2], yrLbl) + "</td></tr>";
      });
      if (group === "hotel") notes = "<div class='callout'>" + tx("Thay đổi lớn: từ 01/11/2026, khách sạn, resort và cơ sở lưu trú có biểu giá riêng, bằng mức giá sản xuất. Giá giờ bình thường (hạ áp) giảm từ " + nf(HOTEL_OLD) + " xuống " + nf(HOTEL_NEW) + " đ/kWh, khoảng " + hotelDrop() + ".", "Big change: from 1 Nov 2026, hotels, resorts and other lodging have their own tariff, set at the manufacturing rate. The normal-hour price (low voltage) fell from " + nf(HOTEL_OLD) + " to " + nf(HOTEL_NEW) + " VND/kWh, about " + hotelDrop() + ".") + "</div>";
      else if (cmp !== "none") notes = "<div class='callout'>" + tx("Các cấp điện áp được phân nhóm lại từ 01/11/2026. Mỗi dòng so sánh với cấp điện áp cũ tương ứng phổ biến nhất.", "Voltage levels were regrouped on 1 Nov 2026. Each row is compared with the most common matching old level.") + "</div>";
    }
    var src = tx("Đơn vị: đồng/kWh, chưa gồm VAT. Nguồn: QĐ 2892/QĐ-BCT", "Unit: VND/kWh, excl. VAT. Source: Decision 2892/QĐ-BCT") +
      (cmp === "y2025" ? tx(", QĐ 1279/QĐ-BCT.", ", Decision 1279/QĐ-BCT.") : cmp === "y2024" ? tx(", QĐ 2699/QĐ-BCT.", ", Decision 2699/QĐ-BCT.") : ".");
    return { title: title, table: h + "</tbody>", notes: notes, src: src };
  }

  var API = { setLang: setLang, groupsHTML: groupsHTML, tariffParts: tariffParts, G: G };
  if (!root.document) {
    if (typeof module === "object" && module && module.exports) module.exports = API;
    root.GiaDien = API;
    return;
  }

  /* ================= BROWSER ================= */
  var doc = root.document;
  setLang(doc.documentElement.lang);
  var $ = function (id) { return doc.getElementById(id); };
  var reduceMotion = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Re-rendering a button list replaces the focused button; put focus back on its replacement. */
  function keepFocus(container, render) {
    var a = doc.activeElement, key = a && container.contains(a) && a.dataset ? JSON.stringify([a.dataset.g, a.dataset.k, a.dataset.v]) : null;
    render();
    if (!key) return;
    var btns = container.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      if (JSON.stringify([btns[i].dataset.g, btns[i].dataset.k, btns[i].dataset.v]) === key) { btns[i].focus(); return; }
    }
  }

  /* ----- hero / tariff ----- */
  var group = "commercial", cmp = "none";
  function renderGroups() {
    var el = $("groups");
    keepFocus(el, function () {
      el.innerHTML = groupsHTML(group);
      el.querySelectorAll(".gcard").forEach(function (b) {
        b.addEventListener("click", function () { group = b.dataset.g; renderGroups(); renderTariff(); });
      });
    });
  }
  function renderTariff() {
    var p = tariffParts(group, cmp);
    $("tariffTitle").textContent = p.title;
    $("tariffTable").innerHTML = p.table;
    $("tariffNotes").innerHTML = p.notes;
    $("tariffSrc").textContent = p.src;
  }
  doc.querySelectorAll("#cmpSeg button").forEach(function (b) {
    b.addEventListener("click", function () {
      cmp = b.dataset.c;
      doc.querySelectorAll("#cmpSeg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      renderTariff();
    });
  });

  /* ----- quiz ----- */
  var Q = { use: null, conn: null, hours: null, usage: null };
  function opt(key, val, label) { return "<button type='button' class='opt' data-k='" + key + "' data-v='" + val + "' aria-pressed='" + (Q[key] === val) + "'>" + label + "</button>"; }
  function renderQuiz() {
    var h = "<div class='q'><p class='qt'><span class='qn'>1</span>" + tx("Bạn dùng điện cho mục đích gì?", "What do you use electricity for?") + "</p><div class='opts'>" +
      opt("use", "residential", tx("Nhà ở, căn hộ", "Home or apartment")) + opt("use", "commercial", tx("Cửa hàng, văn phòng, nhà hàng", "Shop, office, restaurant")) +
      opt("use", "hotel", tx("Khách sạn, resort, homestay", "Hotel, resort, homestay")) + opt("use", "manufacturing", tx("Nhà máy, xưởng sản xuất", "Factory or workshop")) + "</div></div>";
    if (Q.use === "residential") {
      h += "<div class='q'><p class='qt'><span class='qn'>2</span>" + tx("Mỗi tháng nhà bạn dùng khoảng bao nhiêu điện?", "Roughly how much power do you use a month?") + "</p><div class='opts'>" +
        opt("usage", "50", tx("Dưới 100 kWh", "Under 100 kWh")) + opt("usage", "150", "100–200 kWh") + opt("usage", "300", "200–400 kWh") + opt("usage", "550", "400–700 kWh") + opt("usage", "900", tx("Trên 700 kWh", "Over 700 kWh")) + "</div></div>";
    } else if (Q.use) {
      h += "<div class='q'><p class='qt'><span class='qn'>2</span>" + tx("Cơ sở của bạn có trạm biến áp riêng không?", "Does your site have its own transformer?") + "</p><div class='opts'>" +
        opt("conn", "mv", tx("Có, trạm biến áp riêng", "Yes, our own transformer")) +
        (Q.use === "manufacturing" ? opt("conn", "hv", tx("Có, đấu nối 110 kV", "Yes, 110 kV connection")) : "") +
        opt("conn", "lv", tx("Không, dùng lưới hạ thế", "No, low-voltage grid")) + opt("conn", "unsure", tx("Không chắc", "Not sure")) + "</div></div>";
      h += "<div class='q'><p class='qt'><span class='qn'>3</span>" + tx("Bạn dùng điện chủ yếu khi nào?", "When do you use most of your power?") + "</p><div class='opts'>" +
        opt("hours", "day", tx("Ban ngày", "Daytime")) + opt("hours", "dayEve", tx("Ban ngày và buổi tối", "Day and evening")) + opt("hours", "h24", "24/7") + "</div></div>";
    }
    var qs = $("quizQs");
    keepFocus(qs, function () {
      qs.innerHTML = h;
      qs.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          var k = b.dataset.k;
          if (k === "use" && Q.use !== b.dataset.v) { Q.conn = null; Q.hours = null; Q.usage = null; }
          Q[k] = b.dataset.v; renderQuiz();
        });
      });
    });
    renderResult();
  }
  function connId() { if (Q.conn === "unsure") return Q.use === "manufacturing" ? "mv" : "lv"; return Q.conn; }
  function renderResult() {
    var el = $("quizRes"), h;
    var done = Q.use === "residential" ? !!Q.usage : (Q.use && Q.conn && Q.hours);
    if (!done) { el.innerHTML = "<h3>" + tx("Giá điện của bạn", "Your electricity price") + "</h3><p class='res-empty'>" + tx("Trả lời các câu hỏi bên cạnh, kết quả sẽ hiện ở đây.", "Answer the questions and your result appears here.") + "</p>"; return; }
    if (Q.use === "residential") {
      var k = +Q.usage, cur = G.residential.cur, b = tierBill(cur, k), avg = b / k, marg = 0, tier = 1;
      for (var i = 0; i < cur.length; i++) { if (k <= cur[i][0]) { marg = cur[i][1]; tier = i + 1; break; } }
      h = "<h3>" + tx("Giá trung bình của bạn", "Your average price") + "</h3><div class='big'>" + nf(avg) + "</div><p class='cap'>" + unit() + tx(", chưa VAT, ở mức khoảng ", " excl. VAT, at about ") + nf(k) + " kWh" + tx("/tháng", "/month") + "</p>" +
        "<div class='rates'><div class='rate'><span>" + tx("Bậc cao nhất bạn chạm tới", "Highest tier you reach") + "</span><b>" + tx("Bậc ", "Tier ") + tier + "</b></div><div class='rate'><span>" + tx("Giá kWh cuối cùng", "Price of your last kWh") + "</span><b>" + nf(marg) + "</b></div><div class='rate'><span>" + tx("Tiền điện ước tính", "Estimated bill") + "</span><b>" + money(b) + "</b></div></div>" +
        "<p class='tip-line'>" + tx("Mỗi kWh bạn tiết kiệm được tính theo giá bậc cao nhất, nên điện mặt trời giúp giảm phần đắt nhất của hóa đơn.", "Every kWh you save comes off your highest tier, so solar cuts the most expensive part of your bill first.") + "</p>";
    } else {
      var cid = connId(), r = rowOf(Q.use, cid === "hv" && Q.use !== "manufacturing" ? "mv" : cid).cur, avg2 = blend(r, Q.hours);
      h = "<h3>" + L(GN[Q.use]) + " · " + voltLabel(Q.use, cid) + "</h3><div class='big'>" + nf(avg2) + "</div><p class='cap'>" + unit() + tx(", giá trung bình ước tính theo giờ hoạt động của bạn (chưa VAT)", ", estimated average for your operating hours (excl. VAT)") + "</p>" +
        "<div class='rates'><div class='rate'><span>" + tx("Thấp điểm", "Off-peak") + "</span><b>" + nf(r[1]) + "</b></div><div class='rate'><span>" + tx("Bình thường", "Normal") + "</span><b>" + nf(r[0]) + "</b></div><div class='rate'><span>" + tx("Cao điểm", "Peak") + "</span><b>" + nf(r[2]) + "</b></div></div>";
      if (Q.use === "hotel") h += "<p class='tip-line'>" + tx("Từ 01/11/2026 khách sạn trả giá điện bằng giá sản xuất, thấp hơn khoảng " + hotelDrop() + " so với trước.", "From 1 Nov 2026 hotels pay the manufacturing rate, about " + hotelDrop() + " less than before.") + "</p>";
      if (Q.conn === "unsure") h += "<p class='tip-line'>" + tx("Chưa chắc cấp điện áp? Xem dòng “Cấp điện áp” trên hóa đơn tiền điện.", "Not sure of your voltage? Check the voltage line on your electricity bill.") + "</p>";
      h += "<p class='tip-line'>" + (Q.hours === "day" ? tx("Bạn dùng điện chủ yếu ban ngày, đúng lúc điện mặt trời áp mái phát điện. Đây là trường hợp tiết kiệm tốt nhất.", "You use most power in daytime, exactly when rooftop solar produces. That’s the best case for savings.") :
        Q.hours === "dayEve" ? tx("Phần lớn chi phí của bạn rơi vào giờ cao điểm buổi tối. Điện mặt trời kết hợp pin lưu trữ giúp giảm phần này.", "A large share of your cost falls in the evening peak. Solar paired with battery storage can cut it.") :
        tx("Điện mặt trời phủ phần tiêu thụ ban ngày; ban đêm bạn đã được hưởng giá thấp điểm.", "Solar covers your daytime load; at night you already get off-peak rates.")) + "</p>" +
        "<p class='tip-line'>" + tx("Nếu bạn dùng công tơ 1 giá, mọi kWh được tính theo giá giờ bình thường.", "On a single-rate meter, every kWh is charged at the normal-hour price.") + "</p>";
    }
    h += "<button type='button' class='btn' id='toCalc'>" + tx("Tính hóa đơn của tôi", "Calculate my bill") + "</button>";
    el.innerHTML = h;
    $("toCalc").addEventListener("click", function () {
      cg = Q.use; fillCalcGroups(); fillCalcDetails(); setDefaultBill();
      if (Q.use !== "residential") {
        var cid2 = connId(); if (cid2 === "hv" && Q.use !== "manufacturing") cid2 = "mv";
        $("cVolt").value = cid2; $("cProf").value = Q.hours;
      } else {
        var vat = 1 + (+$("cVat").value) / 100; billTouched = true;
        setBill(Math.round(tierBill(G.residential.cur, +Q.usage) * vat / 1000) * 1000);
      }
      calc();
      $("tinh-hoa-don").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      $("calcOut").focus({ preventScroll: true });
    });
  }

  /* ----- calculator ----- */
  var cg = "commercial", billTouched = false;
  var BILL_DEF = { residential: 1500000, commercial: 20000000, hotel: 80000000, manufacturing: 300000000 };
  var billIn = $("bill");
  function setBill(n) { billIn.value = nf(n); lastDigits = String(n); }
  function setDefaultBill() { if (!billTouched) setBill(BILL_DEF[cg]); }
  function fillCalcGroups() {
    var el = $("calcGroup");
    keepFocus(el, function () {
      el.innerHTML = [["residential", tx("Hộ gia đình", "Household")], ["commercial", tx("Kinh doanh", "Commercial")], ["hotel", tx("Khách sạn", "Hotel")], ["manufacturing", tx("Nhà máy", "Factory")]]
        .map(function (o) { return "<button type='button' class='opt' data-v='" + o[0] + "' aria-pressed='" + (cg === o[0]) + "'>" + o[1] + "</button>"; }).join("");
      el.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () { cg = b.dataset.v; fillCalcGroups(); fillCalcDetails(); setDefaultBill(); calc(); });
      });
    });
  }
  function fillCalcDetails() {
    var res = cg === "residential";
    $("fVoltWrap").hidden = res; $("fProfWrap").hidden = res;
    if (res) return;
    var g = G[cg], v = $("cVolt"), p = $("cProf");
    v.innerHTML = g.rows.map(function (r) { return "<option value='" + r.id + "'>" + voltLabel(cg, r.id) + (r.id === g.def ? tx(" (phổ biến)", " (most common)") : "") + "</option>"; }).join("");
    v.value = g.def;
    p.innerHTML = Object.keys(PROF).map(function (k) { return "<option value='" + k + "'>" + L(PROF[k]) + (k === g.prof ? tx(" (phổ biến)", " (most common)") : "") + "</option>"; }).join("");
    p.value = g.prof;
  }
  function parseBill() { return +billIn.value.replace(/[^\d]/g, "") || 0; }
  function calc() {
    var vat = 1 + (+$("cVat").value) / 100, pre = parseBill() / vat, kwh, avg, oldBill, save, kwp, saveNote, title;
    if (!pre) {
      ["oKwh", "oAvg", "oYear", "oOld", "oSave"].forEach(function (id) { $(id).textContent = "–"; });
      $("oSaveNote").textContent = "";
      return;
    }
    if (cg === "residential") {
      var g = G.residential; kwh = tierKwh(g.cur, pre); avg = kwh ? pre / kwh : 0; oldBill = tierBill(g.y2025, kwh);
      save = (pre - tierBill(g.cur, kwh * (1 - SOLAR_SHARE))) * 12; kwp = kwh * SOLAR_SHARE / KWH_PER_KWP_MONTH;
      title = tx("Tiết kiệm mỗi năm với điện mặt trời", "Annual savings with solar");
      saveNote = tx("Hệ thống khoảng " + nf(kwp, 1) + " kWp, phủ khoảng 30% lượng điện của bạn. Phần tiết kiệm được tính từ các bậc giá cao nhất.", "A system of about " + nf(kwp, 1) + " kWp covering around 30% of your usage. Savings come off your highest tiers.");
    } else {
      var vid = $("cVolt").value || G[cg].def, pid = $("cProf").value || G[cg].prof, row = rowOf(cg, vid);
      avg = blend(row.cur, pid); kwh = avg ? pre / avg : 0; oldBill = kwh * blend(row.y2025, pid);
      var P = PROF[pid], share = Math.min(SOLAR_SHARE, 1 - P.p - P.o);
      save = kwh * share * row.cur[0] * PPA_DISC * 12; kwp = kwh * share / KWH_PER_KWP_MONTH;
      title = tx("Tiết kiệm mỗi năm với SmartSolar, từ", "Annual savings with SmartSolar, from");
      saveNote = tx("Hệ thống khoảng " + nf(kwp, 0) + " kWp, không cần vốn đầu tư. SmartSolar lắp đặt, sở hữu và bảo trì; bạn mua điện mặt trời rẻ hơn từ 15% so với giá EVN.", "A system of about " + nf(kwp, 0) + " kWp with no upfront capital. SmartSolar installs, owns and maintains it; you buy the solar power at 15% or more below the EVN price.");
    }
    $("oKwh").textContent = nf(Math.round(kwh)) + " kWh";
    $("oAvg").textContent = nf(avg) + " " + unit();
    $("oYear").textContent = money(pre * 12 * vat);
    $("oOldLbl").textContent = tx("Cùng lượng điện theo giá 05/2025", "Same usage at May 2025 prices");
    var c = chg(pre, oldBill);
    $("oOld").innerHTML = money(oldBill * vat) + tx("/tháng", "/month") + " <span class='" + c.cls + "'>(" + tx("nay ", "now ") + c.s + ")</span>";
    $("sTitle").textContent = title;
    $("oSave").textContent = money(save * vat);
    $("oSaveNote").textContent = saveNote;
  }
  var lastDigits = "";
  function digitsOf(s) { return s.replace(/[^\d]/g, ""); }
  billIn.addEventListener("input", function (e) {
    billTouched = true;
    var raw = billIn.value, caret = billIn.selectionStart == null ? raw.length : billIn.selectionStart;
    var digits = digitsOf(raw), left = digitsOf(raw.slice(0, caret)).length;
    /* Backspace/Delete on a thousands separator: remove the neighbouring digit instead */
    if (digits === lastDigits && e.inputType === "deleteContentBackward" && left > 0) {
      digits = digits.slice(0, left - 1) + digits.slice(left); left -= 1;
    } else if (digits === lastDigits && e.inputType === "deleteContentForward") {
      digits = digits.slice(0, left) + digits.slice(left + 1);
    }
    digits = digits.replace(/^0+(?=\d)/, "");
    lastDigits = digits;
    billIn.value = digits ? nf(+digits) : "";
    var pos = 0, seen = 0, v = billIn.value;
    while (pos < v.length && seen < left) { if (/\d/.test(v[pos])) seen++; pos++; }
    try { billIn.setSelectionRange(pos, pos); } catch (err) { /* not focused */ }
    calc();
  });
  ["cVolt", "cProf", "cVat"].forEach(function (id) { $(id).addEventListener("change", calc); });

  /* ----- day strip: drawn at the container's real width so labels stay 11px on phones ----- */
  var period = "new", SVGNS = "http://www.w3.org/2000/svg";
  function el(tag, a, p, txt) { var e = doc.createElementNS(SVGNS, tag); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; p.appendChild(e); return e; }
  function drawDay() {
    var svg = $("dayStrip"), W = Math.max(300, Math.round(svg.parentNode.clientWidth || 860)), H = 150;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";
    var L0 = 4, R = 4, top = 80, h = 34; function X(hr) { return L0 + hr / 24 * (W - L0 - R); }
    var bands = period === "new" ? [[0, 6, "off"], [6, 17.5, "normal"], [17.5, 22.5, "peak"], [22.5, 24, "normal"]]
      : [[0, 4, "off"], [4, 9.5, "normal"], [9.5, 11.5, "peak"], [11.5, 17, "normal"], [17, 20, "peak"], [20, 22, "normal"], [22, 24, "off"]];
    bands.forEach(function (b) { el("rect", { x: X(b[0]), y: top, width: X(b[1]) - X(b[0]), height: h, "class": "band-" + b[2] }, svg); });
    var pts = []; for (var hr = 6; hr <= 18; hr += .25) { pts.push(X(hr) + "," + (top - 4 - Math.sin((hr - 6) / 12 * Math.PI) * 64)); }
    el("path", { d: "M" + X(6) + "," + (top - 4) + " L" + pts.join(" L") + " L" + X(18) + "," + (top - 4) + " Z", "class": "solar" }, svg);
    var narrow = W < 560;
    /* on phones, drop labels that would collide (the end of the day, and the short 9:30–11:30 / 20:00 bands) */
    var marks = period === "new" ? (narrow ? [0, 6, 12, 17.5, 22.5] : [0, 6, 12, 17.5, 22.5, 24])
      : (narrow ? [0, 4, 9.5, 17, 22] : [0, 4, 9.5, 11.5, 17, 20, 22, 24]);
    marks.forEach(function (m) {
      el("text", { x: X(m), y: top + h + 20, "text-anchor": m === 0 ? "start" : m === 24 ? "end" : "middle", "class": "ax" }, svg, Math.floor(m) + ":" + (m % 1 ? "30" : "00"));
    });
    $("dayTitle").textContent = period === "new" ? tx("Cao điểm 17:30–22:30 · Thấp điểm 0:00–6:00", "Peak 17:30–22:30 · Off-peak 0:00–6:00") : tx("Cao điểm 9:30–11:30 và 17:00–20:00 · Thấp điểm 22:00–4:00", "Peak 9:30–11:30 and 17:00–20:00 · Off-peak 22:00–4:00");
    $("dayInsight").textContent = period === "new"
      ? tx("Giờ cao điểm đã dời hẳn sang buổi tối. Điện mặt trời áp mái giờ thay thế điện giờ bình thường; để giảm chi phí giờ cao điểm, cần kết hợp pin lưu trữ (BESS).", "Peak hours have moved entirely to the evening. Rooftop solar now replaces normal-hour power; cutting peak costs takes solar plus battery storage (BESS).")
      : tx("Trước đây, cao điểm buổi sáng 9:30–11:30 trùng với giờ điện mặt trời phát mạnh nhất, nên mỗi kWh điện mặt trời thay thế giá cao điểm.", "Previously the 9:30–11:30 morning peak overlapped with peak solar output, so each solar kWh replaced peak-priced power.");
  }
  doc.querySelectorAll("#daySeg button").forEach(function (b) {
    b.addEventListener("click", function () {
      period = b.dataset.d;
      doc.querySelectorAll("#daySeg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      drawDay();
    });
  });
  var lastW = 0, raf = 0;
  root.addEventListener("resize", function () {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { var w = $("dayStrip").parentNode.clientWidth; if (w !== lastW) { lastW = w; drawDay(); } });
  });

  /* ----- start ----- */
  setBill(BILL_DEF[cg]);
  renderGroups(); renderTariff(); renderQuiz(); fillCalcGroups(); fillCalcDetails(); calc(); drawDay();
  lastW = $("dayStrip").parentNode.clientWidth;
})(typeof window !== "undefined" ? window : globalThis);
