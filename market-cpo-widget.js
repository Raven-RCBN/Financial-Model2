(() => {
  const snapshot = {
    refreshedAt: "Fri 14 Aug 2026, 17:07 MYT",
    source: "Local cached market snapshot",
    previousClose: "Thu 13 Aug 2026",
    cards: [
      { label: "Front-month FCPO", primary: "RM 4,722", primaryDelta: "RM 7 (+0.15%) day", secondary: "USD 1,156", secondaryDelta: "$2 (+0.17%) day", footnote: "Oct-26 contract (FCPOC1)" },
      { label: "Spot / cash CPO", primary: "RM 4,530", primaryDelta: "RM 10 (+0.22%) day", secondary: "USD 1,109", secondaryDelta: "$3 (+0.27%) day", footnote: "Aug-26 nearby" },
      { label: "USD / MYR", primary: "4.0865", primaryDelta: "0.0005 MYR firmer", secondary: "", secondaryDelta: "", footnote: "USD changes vs prev day" },
      { label: "Volume (Oct-26)", primary: "26,853", primaryDelta: "lots traded", secondary: "", secondaryDelta: "", footnote: "Open interest: 95,273", negative: "(-12,268)" }
    ],
    curve: {
      title: "Forward curve - FCPO 12 months",
      subtitle: "Peak: Mar-27 RM5,001 (NEW YTD HIGH!) | Q4 avg RM4,811 | premium +RM471 over spot",
      labels: ["Aug-26", "Sep-26", "Oct-26", "Nov-26", "Dec-26", "Jan-27", "Feb-27", "Mar-27", "Apr-27", "May-27", "Jun-27", "Jul-27"],
      prices: [4530, 4580, 4722, 4820, 4890, 4950, 4980, 5001, 4995, 4980, 4950, 4910],
      volume: [0, 7000, 27000, 23000, 12000, 11000, 6000, 7000, 5000, 6000, 4000, 3000]
    },
    today: [
      ["Today (front-month Oct-26)", "RM 4,722", "neutral"],
      ["1-week change", "▲ RM 46 (+0.98%)", "up"],
      ["1-month change", "▲ RM 211 (+4.68%)", "up"],
      ["Today's high / low", "4,760 / 4,702", "neutral"],
      ["YTD range", "3,938 - 5,001 (NEW HIGH!)", "neutral"],
      ["Position in YTD range", "74th percentile", "neutral"]
    ],
    adjacent: [
      ["DCE soyoil (overnight)", "+0.5%", "up"],
      ["CBOT soyoil", "+0.1%", "up"],
      ["Brent crude", "$88.42 (+1.6% d/d)", "up"],
      ["CPO-SBO spread*", "-$397 (CPO discount)", "down"],
      ["MPOB stocks (Jul)", "2.63 mn t (+3.32% m/m)", "up"],
      ["Export (MPOB, Jul)", "+14.5% m/m to 1.39 mn t", "up"]
    ]
  };

  const styleId = "local-cpo-widget-style";
  const css = `
    .public-cpo-report{padding:14px;display:grid;gap:10px;color:var(--ink,#10263c)}
    .cpo-report-head{display:flex;justify-content:space-between;gap:18px;align-items:start}
    .cpo-report-head h3{font-size:22px;line-height:1.05;margin:0 0 6px;font-weight:720;letter-spacing:0;color:var(--ink,#10263c)}
    .cpo-report-head p,.cpo-source span{margin:0;color:#596b7a;font-weight:650;font-size:11px}
    .cpo-source{display:grid;gap:2px;text-align:right;min-width:170px}.cpo-feed-note{color:#9a6b11!important;font-size:12px!important}
    .cpo-refresh-btn{appearance:none;border:1px solid #b7d6c5;border-radius:8px;background:#f7fffb;color:#247a51;font-weight:760;padding:5px 9px;font-size:12px;cursor:pointer;margin-top:8px}.cpo-refresh-btn:hover{background:#edf9f2}
    .cpo-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cpo-market-card,.cpo-chart-card,.cpo-detail-card{border:1px solid #dde7ee;border-radius:8px;background:#fff;box-shadow:0 1px 2px rgba(15,43,68,.04)}
    .cpo-market-card{padding:10px 12px;min-height:88px}.cpo-market-card h4{font-size:12px;margin:0 0 6px;font-weight:720}.cpo-market-card strong{display:block;font-size:20px;line-height:1.08;font-weight:760;letter-spacing:0}.cpo-secondary{margin-top:8px}.cpo-delta{display:block;margin-top:3px;font-size:11px;font-weight:760}.is-up{color:#2f8c56}.is-down{color:#b64545}.is-muted{color:#4f5d68}.cpo-market-card small{display:block;margin-top:8px;color:#7f858b;font-size:12px;font-weight:650}.cpo-market-card em{font-style:normal;color:#b64545}
    .cpo-chart-card{padding:10px 12px 6px}.cpo-chart-head{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.cpo-chart-head h4{margin:0;font-size:14px}.cpo-chart-head p{margin:0;color:#3d4148;font-size:11px;font-weight:650}.cpo-chart{width:100%;height:150px;display:block}.cpo-gridline{stroke:#e5e9ec;stroke-width:1}.cpo-axis{fill:#7a7f84;font-size:13px;font-weight:650}.cpo-x-label{fill:#30363b}.cpo-volume-bar{fill:#d7dde8;opacity:.9}.cpo-price-area{fill:#dfeee5;opacity:.8}.cpo-price-line{fill:none;stroke:#2f8c74;stroke-width:3}.cpo-price-dot{fill:#2f8c74;stroke:#fff;stroke-width:1.5}
    .cpo-bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cpo-detail-card{padding:10px 12px}.cpo-detail-card h4{margin:0 0 6px;font-size:15px}.cpo-list-row{display:grid;grid-template-columns:1.2fr 1fr;gap:10px;border-top:1px solid #edf1f4;padding:5px 0;align-items:start}.cpo-list-row:first-of-type{border-top:0}.cpo-list-row span{font-size:12px;color:#3e4247}.cpo-list-row strong{text-align:right;font-size:12px}.cpo-detail-card small{display:block;color:#8c949b;font-weight:650;margin-top:4px}
    @media(max-width:1100px){.cpo-kpi-grid,.cpo-bottom-grid{grid-template-columns:1fr 1fr}.cpo-report-head{display:grid}.cpo-source{text-align:left}}
    @media(max-width:720px){.cpo-kpi-grid,.cpo-bottom-grid{grid-template-columns:1fr}.public-cpo-report{padding:16px}.cpo-report-head h3{font-size:24px}}
  `;

  function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
  function formatWhole(value){return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(value)}
  function installStyle(){let style=document.getElementById(styleId);if(!style){style=document.createElement("style");style.id=styleId;document.head.appendChild(style)}style.textContent=css}
  function curveSvg(report){const labels=report.curve.labels,prices=report.curve.prices,volumes=report.curve.volume,width=780,height=230,pad={top:18,right:54,bottom:34,left:58},min=4400,max=5200,maxVol=60000,step=(width-pad.left-pad.right)/(labels.length-1),x=i=>pad.left+i*step,y=v=>pad.top+((max-v)/(max-min))*(height-pad.top-pad.bottom),base=y(min),points=prices.map((v,i)=>`${x(i)},${y(v)}`).join(" "),area=`${pad.left},${base} ${points} ${x(labels.length-1)},${base}`;const grid=[4400,4600,4800,5000,5200].map(t=>`<line x1="${pad.left}" x2="${width-pad.right}" y1="${y(t)}" y2="${y(t)}" class="cpo-gridline"/><text x="${pad.left-10}" y="${y(t)+5}" text-anchor="end" class="cpo-axis">RM${formatWhole(t)}</text>`).join("");const bars=volumes.map((v,i)=>{const h=Math.max(2,(v/maxVol)*70),w=Math.min(18,step*.44);return`<rect x="${x(i)-w/2}" y="${base-h}" width="${w}" height="${h}" rx="2" class="cpo-volume-bar"/>`}).join("");const xl=labels.map((l,i)=>`<text x="${x(i)}" y="${height-10}" text-anchor="middle" class="cpo-axis cpo-x-label">${escapeHtml(l)}</text>`).join("");return`<svg class="cpo-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="FCPO twelve month forward curve">${grid}${bars}<polygon points="${area}" class="cpo-price-area"></polygon><polyline points="${points}" class="cpo-price-line"></polyline>${prices.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="3" class="cpo-price-dot"><title>${labels[i]} RM${formatWhole(v)}</title></circle>`).join("")}${xl}<text x="${pad.left}" y="12" class="cpo-axis">Price</text><text x="${width-16}" y="12" text-anchor="end" class="cpo-axis">Volume</text><text x="${width-16}" y="${y(5000)+4}" text-anchor="end" class="cpo-axis">40k</text><text x="${width-16}" y="${y(4600)+4}" text-anchor="end" class="cpo-axis">20k</text><text x="${width-16}" y="${base+4}" text-anchor="end" class="cpo-axis">0k</text></svg>`}
  function rowList(rows){return rows.map(([label,value,tone])=>`<div class="cpo-list-row"><span>${escapeHtml(label)}</span><strong class="${tone==="up"?"is-up":tone==="down"?"is-down":""}">${escapeHtml(value)}</strong></div>`).join("")}
  function findPanel(){const existing=document.querySelector("#publicCpoReport");if(existing)return existing;const headings=Array.from(document.querySelectorAll("h1,h2,h3"));const heading=headings.find(h=>h.textContent?.trim()==="Initial Workbook Migration")||headings.find(h=>h.textContent?.includes("Workbook Migration"));const panel=heading?.closest(".panel,article,section");if(!panel)return null;panel.innerHTML='<div id="publicCpoReport"></div>';return panel.querySelector("#publicCpoReport")}
  function render(report=snapshot,refreshed=false){installStyle();const target=findPanel();if(!target)return false;target.innerHTML=`<section class="public-cpo-report" aria-label="CPO public market report"><div class="cpo-report-head"><div><h3>CPO report</h3><p>${escapeHtml(report.refreshedAt)}</p></div><div class="cpo-source"><span>Source: ${escapeHtml(report.source)}</span><span>Prev close: ${escapeHtml(report.previousClose)}</span><button class="cpo-refresh-btn" type="button">Refresh</button>${refreshed?'<span class="cpo-feed-note">Local cache refreshed.</span>':''}</div></div><div class="cpo-kpi-grid">${report.cards.map(card=>`<article class="cpo-market-card"><h4>${escapeHtml(card.label)}</h4><strong>${escapeHtml(card.primary)}</strong>${card.primaryDelta?`<span class="cpo-delta ${card.label.includes("Volume")?"is-muted":"is-up"}">${card.label.includes("Volume")?"":"▲ "}${escapeHtml(card.primaryDelta)}</span>`:""}${card.secondary?`<strong class="cpo-secondary">${escapeHtml(card.secondary)}</strong>`:""}${card.secondaryDelta?`<span class="cpo-delta is-up">▲ ${escapeHtml(card.secondaryDelta)}</span>`:""}<small>${escapeHtml(card.footnote||"")} ${card.negative?`<em>${escapeHtml(card.negative)}</em>`:""}</small></article>`).join("")}</div><article class="cpo-chart-card"><div class="cpo-chart-head"><h4>${escapeHtml(report.curve.title)}</h4><p>${escapeHtml(report.curve.subtitle)}</p></div>${curveSvg(report)}</article><div class="cpo-bottom-grid"><article class="cpo-detail-card"><h4>Where today sits</h4>${rowList(report.today)}</article><article class="cpo-detail-card"><h4>Adjacent markets</h4>${rowList(report.adjacent)}<small>*estimated from CBOT front-month (68.29¢/lb) vs Aug-26 spot</small></article></div></section>`;target.querySelector(".cpo-refresh-btn")?.addEventListener("click",()=>{localStorage.setItem("agriintel.cpoPublicReport.v1",JSON.stringify(snapshot));localStorage.setItem("agriintel.cpoPublicReport.lastRefresh",new Date().toISOString());render(snapshot,true)});return true}
  window.renderLocalCpoMarketWidget=render;
  render();
})();

;(() => {
  async function refreshFromLocalCache(showMessage = false) {
    try {
      const response = await fetch(`/public-cpo-data.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Local cache returned ${response.status}`);
      const report = await response.json();
      localStorage.setItem("agriintel.cpoPublicReport.v1", JSON.stringify(report));
      localStorage.setItem("agriintel.cpoPublicReport.lastRefresh", new Date().toISOString());
      if (window.renderLocalCpoMarketWidget) window.renderLocalCpoMarketWidget(report, showMessage);
    } catch (error) {
      console.warn("Unable to refresh local CPO cache", error);
    }
  }
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".cpo-refresh-btn")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    refreshFromLocalCache(true);
  }, true);
  setTimeout(() => refreshFromLocalCache(false), 150);
})();
