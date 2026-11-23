// Closet Studio: "Dress it on a model" add-on for the phone app.
// Plain script (no build step): shoot garments, pick a vibe, and send the raw photos straight to
// Google Drive > Closet Studio > Closet In through the phone's share sheet. The Colab notebook
// dresses them and the finished photos come back through Closet Out.
// Rule: raw shots are NOT saved on the phone; only finished photos from Closet Out are kept.
(function () {
  "use strict";

  // Same names and order as notebook/source/vibes.py (12 pink first). Keep in sync.
  var PINK = ["Pink Luxe", "Hot Pink Glam", "Parisian Pink", "Blush Bridal", "Pink Champagne",
    "Rose Garden Party", "Pink Penthouse", "Soft Glam Vanity", "Pink Riviera", "Ballerina Luxe",
    "Cherry Blossom", "Pink Ski Chalet"];
  var MORE = ["Classic", "Minimalist", "Old Money", "Preppy", "Business Casual", "Quiet Luxury",
    "Parisian Chic", "Coastal Grandmother", "Boho", "Festival", "Cottagecore", "Hippie 70s",
    "Earthy Neutral", "Farmhouse", "Outdoorsy", "Lake Life", "Western", "Rodeo", "Rustic Country",
    "Southwestern", "Streetwear", "Urban", "Skater", "Hip-Hop 90s", "Techwear", "Athleisure",
    "Sporty", "Y2K", "Grunge", "Punk", "Rocker", "Gothic", "Dark Academia", "Biker", "50s Retro",
    "60s Mod", "70s Disco", "80s Neon", "Vintage Thrift", "Romantic", "Coquette", "Light Academia",
    "Balletcore", "Fairycore", "Summer Beach", "Tropical", "Fall Harvest", "Cozy Winter",
    "Apres-Ski", "Spring Garden", "Mountain", "Holiday", "Date Night", "Cocktail", "Formal Gala",
    "Wedding Guest", "Glam", "Workwear Rugged", "Casual Weekend", "Mom on the Go", "Lounge",
    "Travel", "Maximalist", "Kidcore"];

  var LSKEY = "closetVibe";
  var vibe = "Auto";
  try { vibe = localStorage.getItem(LSKEY) || "Auto"; } catch (e) {}
  if (vibe !== "Auto" && PINK.indexOf(vibe) < 0 && MORE.indexOf(vibe) < 0) vibe = "Auto";
  var showAll = false;
  var queue = []; // {file: File, url: string}

  function $(s) { return document.querySelector(s); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function toast(t) {
    var e = $("#toast"); if (!e) return;
    e.textContent = t; e.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { e.hidden = true; }, 3500);
  }

  // ---------- Build the UI ----------
  var home = $("#home");
  if (!home) return;

  var box = el("div", "cs-box");
  box.innerHTML =
    '<h2 class="cs-h">Dress it on a model</h2>' +
    '<p class="cs-sub">Shoot the piece, pick a vibe, send it to <b>Closet In</b>. ' +
    'The finished model photos come back in <b>Closet Out</b>.</p>' +
    '<div class="cs-label">Vibe <span id="csVibeName"></span></div>' +
    '<div class="cs-chips" id="csChips"></div>' +
    '<button class="cs-more" id="csMore" type="button">Show all 76 vibes</button>' +
    '<label class="big primary cs-shoot">📷 Shoot for Closet In' +
    '<input id="csCam" type="file" accept="image/*" capture="environment" multiple></label>' +
    '<label class="cs-link">or pick photos already on the phone' +
    '<input id="csGal" type="file" accept="image/*" multiple></label>';
  home.insertBefore(box, home.firstChild);

  var divider = el("div", "cs-divider", "<span>or just clean up the background</span>");
  home.insertBefore(divider, box.nextSibling);

  var sheet = el("section", "cs-sheet");
  sheet.id = "csSheet";
  sheet.hidden = true;
  sheet.innerHTML =
    '<div class="cs-sheet-in">' +
    '<div class="cs-sheet-top"><b id="csCount"></b>' +
    '<button class="iconbtn" id="csClose" type="button">✕</button></div>' +
    '<div class="cs-thumbs" id="csThumbs"></div>' +
    '<div class="cs-label">Vibe <span id="csVibeName2"></span></div>' +
    '<div class="cs-chips" id="csChips2"></div>' +
    '<div class="row">' +
    '<label class="small">📷 Shoot another<input id="csCam2" type="file" accept="image/*" capture="environment" multiple></label>' +
    '</div>' +
    '<button class="big primary cs-send" id="csSend" type="button">Send to Closet In</button>' +
    '<p class="cs-hint" id="csHint">In the share menu pick <b>Drive</b>, then choose the folder ' +
    '<b>Closet Studio › Closet In</b> and tap <b>Upload</b>.</p>' +
    '<button class="cs-link cs-fallback" id="csDownload" type="button" hidden>' +
    'Sharing isn’t available here. Download instead (this saves copies on the phone)</button>' +
    "</div>";
  document.body.appendChild(sheet);

  function chipHtml(name, isPink) {
    var on = name === vibe ? " on" : "";
    var pink = isPink ? " pink" : "";
    var label = name === "Auto" ? "✨ Auto" : esc(name);
    return '<button type="button" class="cs-chip' + on + pink + '" data-v="' + esc(name) + '">' + label + "</button>";
  }

  function renderChips() {
    var extra = showAll ? MORE : (MORE.indexOf(vibe) >= 0 ? [vibe] : []);
    var html = chipHtml("Auto", false);
    PINK.forEach(function (n) { html += chipHtml(n, true); });
    extra.forEach(function (n) { html += chipHtml(n, false); });
    $("#csChips").innerHTML = html;
    $("#csChips2").innerHTML = html;
    var txt = vibe === "Auto" ? "Auto (the notebook picks one)" : vibe;
    $("#csVibeName").textContent = "· " + txt;
    $("#csVibeName2").textContent = "· " + txt;
    $("#csMore").textContent = showAll ? "Show fewer vibes" : "Show all 76 vibes";
  }

  function pickVibe(e) {
    var b = e.target.closest(".cs-chip");
    if (!b) return;
    vibe = b.getAttribute("data-v");
    try { localStorage.setItem(LSKEY, vibe); } catch (err) {}
    renderChips();
    renameQueue();
  }
  $("#csChips").addEventListener("click", pickVibe);
  $("#csChips2").addEventListener("click", pickVibe);
  $("#csMore").addEventListener("click", function () { showAll = !showAll; renderChips(); });

  // ---------- Photos ----------
  function stamp(d) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  // File name carries the vibe: "item-20261122-193000-1__Pink Luxe.jpg". Auto = no vibe part.
  function fileName(base) {
    return base + (vibe === "Auto" ? "" : "__" + vibe) + ".jpg";
  }

  // Upright, max 2048 px, JPEG: keeps uploads quick on mobile data while plenty for the try-on.
  function prepare(file) {
    var max = 2048;
    var load = window.createImageBitmap
      ? createImageBitmap(file, { imageOrientation: "from-image" })
      : new Promise(function (res, rej) {
        var img = new Image(); img.onload = function () { res(img); }; img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
    return load.then(function (bmp) {
      var s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      return new Promise(function (res) { cv.toBlob(res, "image/jpeg", 0.92); });
    });
  }

  function addFiles(files) {
    if (!files || !files.length) return;
    var arr = Array.prototype.slice.call(files);
    var t = stamp(new Date());
    var start = queue.length;
    return Promise.all(arr.map(function (f, i) {
      return prepare(f).then(function (blob) {
        var base = "item-" + t + "-" + (start + i + 1);
        var file = new File([blob], fileName(base), { type: "image/jpeg" });
        return { base: base, file: file, url: URL.createObjectURL(blob) };
      });
    })).then(function (items) {
      queue = queue.concat(items);
      openSheet();
    }).catch(function (e) {
      toast("Couldn't read that photo: " + (e && e.message ? e.message : e));
    });
  }

  function renameQueue() {
    queue.forEach(function (q) {
      q.file = new File([q.file], fileName(q.base), { type: "image/jpeg" });
    });
  }

  function renderThumbs() {
    var wrap = $("#csThumbs");
    wrap.innerHTML = "";
    queue.forEach(function (q, i) {
      var d = el("div", "cs-thumb");
      d.innerHTML = '<img alt="">' + '<button type="button" aria-label="Remove">✕</button>';
      d.querySelector("img").src = q.url;
      d.querySelector("button").onclick = function () {
        URL.revokeObjectURL(q.url);
        queue.splice(i, 1);
        if (!queue.length) closeSheet(); else renderThumbs();
      };
      wrap.appendChild(d);
    });
    var n = queue.length;
    $("#csCount").textContent = n + (n === 1 ? " piece ready" : " pieces ready");
    $("#csSend").textContent = n === 1 ? "Send to Closet In" : "Send " + n + " to Closet In";
  }

  function canShareFiles() {
    try {
      var probe = new File([new Blob(["x"], { type: "image/jpeg" })], "probe.jpg", { type: "image/jpeg" });
      return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch (e) { return false; }
  }

  function openSheet() {
    renderChips();
    renderThumbs();
    var ok = canShareFiles();
    $("#csDownload").hidden = ok;
    $("#csHint").hidden = !ok;
    sheet.hidden = false;
    document.body.classList.add("cs-lock");
  }

  function closeSheet() {
    queue.forEach(function (q) { URL.revokeObjectURL(q.url); });
    queue = [];
    sheet.hidden = true;
    document.body.classList.remove("cs-lock");
  }

  $("#csClose").onclick = function () {
    if (queue.length && !confirmClose()) return;
    closeSheet();
  };
  // No browser confirm() dialogs: a second tap within 3 s closes.
  var closeArmed = 0;
  function confirmClose() {
    if (Date.now() - closeArmed < 3000) return true;
    closeArmed = Date.now();
    toast("Tap ✕ again to discard these photos");
    return false;
  }

  $("#csSend").onclick = function () {
    if (!queue.length) return;
    var files = queue.map(function (q) { return q.file; });
    if (!canShareFiles()) { $("#csDownload").hidden = false; return; }
    navigator.share({ files: files, title: "Closet In" }).then(function () {
      toast(files.length === 1 ? "Sent ✨ Check Closet Out in a few minutes"
        : "Sent " + files.length + " ✨ Check Closet Out in a few minutes");
      closeSheet();
    }).catch(function (e) {
      if (e && e.name === "AbortError") return; // user closed the share menu
      toast("Couldn't share: " + (e && e.message ? e.message : e));
    });
  };

  $("#csDownload").onclick = function () {
    queue.forEach(function (q) {
      var a = document.createElement("a");
      a.href = q.url; a.download = q.file.name;
      document.body.appendChild(a); a.click(); a.remove();
    });
    toast("Downloaded. Move them to Drive › Closet In, then delete them from the phone.");
  };

  function take(e) {
    var files = e.target.files;
    addFiles(files);
    e.target.value = "";
  }
  $("#csCam").addEventListener("change", take);
  $("#csGal").addEventListener("change", take);
  $("#csCam2").addEventListener("change", take);

  renderChips();
  window.__closetStudio = { queue: function () { return queue; }, vibe: function () { return vibe; } };
})();
