/* ============================================================================
   A small hash router over discrete full-screen views.

   Each <section class="view"> holds one or more <article class="page">.
   Exactly one view and one page are shown at a time, so nothing ever exceeds
   the viewport. Pages that genuinely don't fit a short window scroll
   internally rather than clipping — hiding text is never the right trade.

   No dependencies. Degrades to a plain long document if JS never runs.
   ========================================================================= */

(function () {
  "use strict";

  /* The address is never written as a literal anywhere in the served files.
     Harvesters scrape static HTML and rarely execute page scripts, so building
     it from parts at runtime keeps it out of scraped lists while staying
     completely transparent to a real visitor. */
  var EMAIL = ["iamtejaswi", String.fromCharCode(64), "hotmail", ".", "com"].join("");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------- router -------------------------------- */

  var views = Array.prototype.slice.call(document.querySelectorAll(".view"));
  var nav = document.querySelector(".topbar-nav");
  var navPill = document.querySelector(".nav-pill");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".topbar-nav a"));

  var pager = document.getElementById("pager");
  var pagerPrev = document.getElementById("pager-prev");
  var pagerNext = document.getElementById("pager-next");
  var pagerDots = document.getElementById("pager-dots");

  // Ordered list of view names, used for wrapping past the first/last page.
  var order = views.map(function (v) {
    return v.getAttribute("data-view");
  });

  var state = { view: order[0], page: 1 };

  // Every page in the document, so render() can clear stale active classes in
  // views that are currently hidden.
  var allPages = Array.prototype.slice.call(document.querySelectorAll(".page"));

  function viewEl(name) {
    return document.getElementById("view-" + name);
  }

  function pagesOf(name) {
    var v = viewEl(name);
    return v ? Array.prototype.slice.call(v.querySelectorAll(".page")) : [];
  }

  /* Assign stagger indices so children cascade in document order. Nested
     containers inherit their parent's offset, so a grid inside a page keeps
     flowing from where the page's own children left off rather than restarting
     at zero. */
  function primeStagger(page) {
    var containers = [page.querySelector(".stagger")].filter(Boolean);
    containers = containers.concat(
      Array.prototype.slice.call(page.querySelectorAll(".stagger .stagger"))
    );

    containers.forEach(function (c) {
      var parent = c.parentElement.closest(".stagger");
      var base = 0;
      if (parent) {
        // Continue counting from this container's own position in its parent.
        var idx = Array.prototype.indexOf.call(parent.children, c);
        base = (parseInt(parent.dataset.staggerBase, 10) || 0) + Math.max(idx, 0);
      }
      c.dataset.staggerBase = base;

      Array.prototype.forEach.call(c.children, function (child, i) {
        child.style.setProperty("--i", base + i);
      });
    });
  }

  function render(dir) {
    views.forEach(function (v) {
      var isActive = v.getAttribute("data-view") === state.view;
      v.classList.toggle("is-active", isActive);
      // Keep hidden views out of the accessibility tree and tab order.
      v.toggleAttribute("inert", !isActive);
      v.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    // Every page in the document, not just this view's: a page left marked
    // active inside a hidden view is invisible but still matches global
    // `.page.is-active` queries, which would target the wrong element.
    var pages = pagesOf(state.view);
    allPages.forEach(function (p) {
      var isActive = pages.indexOf(p) === state.page - 1 && p.closest(".view") === viewEl(state.view);
      p.classList.remove("from-next", "from-prev");
      p.classList.toggle("is-active", isActive);
      p.toggleAttribute("inert", !isActive);
      if (isActive) {
        p.scrollTop = 0;
        primeStagger(p);
        if (!reduceMotion) {
          // Force a reflow so the animation restarts on repeat navigation.
          void p.offsetWidth;
          p.classList.add(dir < 0 ? "from-prev" : "from-next");
        }
      }
    });

    navLinks.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-view") === state.view);
    });

    moveNavPill();

    renderPager(pages.length);
    document.title = titleFor(state.view);
  }

  /* Slide the segmented-control pill onto the active nav item. Positions are
     measured rather than hard-coded, so the pill stays correct when the labels
     reflow at different widths or the font loads late. */
  function moveNavPill() {
    if (!navPill) return;
    var active = null;
    for (var i = 0; i < navLinks.length; i++) {
      if (navLinks[i].classList.contains("is-active")) {
        active = navLinks[i];
        break;
      }
    }
    if (!active) {
      nav.classList.remove("is-ready");
      return;
    }
    // offsetLeft is relative to the nav's padding box, which is the pill's
    // containing block — no getBoundingClientRect arithmetic needed.
    navPill.style.setProperty("--pill-x", active.offsetLeft + "px");
    navPill.style.setProperty("--pill-w", active.offsetWidth + "px");
    nav.classList.add("is-ready");
  }

  function titleFor(view) {
    var base = "Tejaswi";
    if (view === "home") return base;
    // The route stays "work" so existing links keep resolving, but the section
    // is presented as Projects.
    var labels = { work: "Projects" };
    var name = labels[view] || view.charAt(0).toUpperCase() + view.slice(1);
    return name + " · " + base;
  }

  function renderPager(count) {
    if (!pager) return;

    // A single-page view needs no dots, but still needs view-to-view arrows.
    pagerDots.innerHTML = "";
    for (var i = 1; i <= count; i++) {
      (function (n) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "pager-dot" + (n === state.page ? " is-current" : "");
        dot.setAttribute("aria-label", "Page " + n + " of " + count);
        dot.setAttribute("aria-current", n === state.page ? "true" : "false");
        dot.addEventListener("click", function () {
          go(state.view, n);
        });
        pagerDots.appendChild(dot);
      })(i);
    }

    var atStart = state.view === order[0] && state.page === 1;
    var atEnd =
      state.view === order[order.length - 1] && state.page === count;

    pagerPrev.disabled = atStart;
    pagerNext.disabled = atEnd;
    pager.hidden = false;
  }

  /* Move one page forward or back, rolling into the next/previous view at the
     boundaries so the whole site reads as one continuous sequence. */
  function step(delta) {
    var pages = pagesOf(state.view);
    var next = state.page + delta;

    if (next >= 1 && next <= pages.length) {
      go(state.view, next, delta);
      return;
    }

    var vi = order.indexOf(state.view) + delta;
    if (vi < 0 || vi >= order.length) return;

    var name = order[vi];
    var target = delta > 0 ? 1 : pagesOf(name).length;
    go(name, target, delta);
  }

  function go(view, page, dir) {
    if (order.indexOf(view) === -1) view = order[0];
    var pages = pagesOf(view);
    page = Math.min(Math.max(page || 1, 1), Math.max(pages.length, 1));

    var changed = view !== state.view || page !== state.page;
    state.view = view;
    state.page = page;

    var hash = "#" + view + (page > 1 ? "/" + page : "");
    if (location.hash !== hash) {
      history.pushState(null, "", hash);
    }
    render(changed ? dir || 0 : 0);
  }

  function readHash() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return { view: order[0], page: 1 };
    var bits = raw.split("/");
    var view = order.indexOf(bits[0]) !== -1 ? bits[0] : order[0];
    var page = parseInt(bits[1], 10);
    return { view: view, page: isNaN(page) ? 1 : page };
  }

  function applyHash(dir) {
    var h = readHash();
    var pages = pagesOf(h.view);
    state.view = h.view;
    state.page = Math.min(Math.max(h.page, 1), Math.max(pages.length, 1));
    render(dir || 0);
  }

  // Intercept in-page links so they route rather than jumping.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var raw = a.getAttribute("href").slice(1);
    if (!raw || raw === "main") return;
    var bits = raw.split("/");
    if (order.indexOf(bits[0]) === -1) return;
    e.preventDefault();
    var from = order.indexOf(state.view);
    var to = order.indexOf(bits[0]);
    go(bits[0], parseInt(bits[1], 10) || 1, to === from ? 0 : to > from ? 1 : -1);
  });

  window.addEventListener("popstate", function () {
    applyHash(0);
  });

  /* The pill's geometry is measured, so it must be re-measured whenever the
     nav can reflow: on resize, and once the webfont swaps in (which changes
     every label's width). Both are cheap and idempotent. */
  var navResizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(navResizeTimer);
    navResizeTimer = setTimeout(moveNavPill, 120);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(moveNavPill);
  }

  if (pagerPrev) pagerPrev.addEventListener("click", function () { step(-1); });
  if (pagerNext) pagerNext.addEventListener("click", function () { step(1); });

  /* Keyboard: arrows page through, but never while the visitor is typing or
     using a control that owns those keys. */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;

    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(order[0], 1, -1);
    } else if (e.key === "End") {
      e.preventDefault();
      var last = order[order.length - 1];
      go(last, pagesOf(last).length, 1);
    }
  });

  /* Horizontal wheel / trackpad swipe pages sideways. Vertical is left alone
     so a page that overflows can still be scrolled normally. */
  var wheelLock = false;
  window.addEventListener(
    "wheel",
    function (e) {
      if (wheelLock) return;
      if (Math.abs(e.deltaX) < 40 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.6) return;
      wheelLock = true;
      step(e.deltaX > 0 ? 1 : -1);
      setTimeout(function () { wheelLock = false; }, 520);
    },
    { passive: true }
  );

  /* Touch: horizontal swipe pages, vertical is left to the page itself. */
  (function touchNav() {
    var x0 = null, y0 = null, t0 = 0;
    document.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    }, { passive: true });

    document.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0;
      var dy = t.clientY - y0;
      var dt = Date.now() - t0;
      x0 = null;
      if (dt > 700) return;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      step(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  applyHash(0);

  /* --------------------------- topbar shadow ----------------------------- */

  var topbar = document.querySelector(".topbar");
  if (topbar) topbar.classList.add("is-stuck");

  /* ---------------------------- cursor glow ------------------------------ */

  /* An amber halo that follows the pointer, plus a local spotlight on whichever
     tile is under it. Everything is written on a single rAF tick so a fast
     mouse can't queue up layout work, and the whole thing is skipped for touch
     devices and reduced-motion users. */
  (function cursorGlow() {
    var glow = document.getElementById("cursor-glow");
    if (!glow || reduceMotion) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var TILE_SELECTOR =
      ".principle, .project, .offclock-item, .readout-cell, .skillset, .clink, .contact-form";

    var mx = 0, my = 0, queued = false, live = false;

    function paint() {
      queued = false;
      glow.style.setProperty("--mx", mx + "px");
      glow.style.setProperty("--my", my + "px");

      if (!live) {
        live = true;
        glow.classList.add("is-live");
      }

      // Only tiles inside the visible page can be under the cursor.
      var page = document.querySelector(".page.is-active");
      if (!page) return;
      var tiles = page.querySelectorAll(TILE_SELECTOR);

      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        var r = tile.getBoundingClientRect();
        var x = mx - r.left;
        var y = my - r.top;
        var inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;

        if (inside) {
          tile.style.setProperty("--sx", x + "px");
          tile.style.setProperty("--sy", y + "px");
          tile.style.setProperty("--slit", "1");
        } else if (tile.style.getPropertyValue("--slit") !== "0") {
          tile.style.setProperty("--slit", "0");
        }
      }
    }

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });

    document.addEventListener("mouseleave", function () {
      live = false;
      glow.classList.remove("is-live");
      document.querySelectorAll("[style*='--slit']").forEach(function (t) {
        t.style.setProperty("--slit", "0");
      });
    });
  })();

  /* ------------------------------ origin map ----------------------------- */

  /* A static slippy-map view stitched from Esri's dark canvas tiles.
     Deliberately not a map library: this is decoration, so it should cost one
     small script and a handful of images rather than a 200KB dependency.

     ⚠️ Moved off CARTO's dark-matter in Aug 2026, when CARTO began stamping
     "API KEY REQUIRED" diagonally across their keyless basemap tiles. The
     tiles still returned 200 — the watermark is painted into the image, so
     nothing failed and nothing logged; the map simply started carrying an
     advertisement.

     A free CARTO key exists and covers 5M tiles a month, but any key used from
     a static site sits in public JavaScript where anyone can lift it, and
     CARTO's own terms ask that keys not be shared. Esri's canvas is keyless,
     which leaves nothing to leak, rotate or renew. */
  (function originMap() {
    var el = document.getElementById("origin-map");
    if (!el) return;

    var LAT = 12.9141, LON = 74.856, ZOOM = 11, TILE = 256;

    /* The panel is a letterbox on short phones — about 90px tall — and the
       MANGALURU label sits roughly 65px below the pin at zoom 11, so it falls
       outside the crop. Backing off one zoom level halves that offset and
       brings both the label and the coastline back inside. */
    function zoomFor(h) {
      return h < 120 ? ZOOM - 1 : ZOOM;
    }

    function lonToX(lon, z) {
      return ((lon + 180) / 360) * Math.pow(2, z);
    }

    function latToY(lat, z) {
      var rad = (lat * Math.PI) / 180;
      return (
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
        Math.pow(2, z)
      );
    }

    function build() {
      // Fractional, not clientWidth: the panel is fluid, so its used width is
      // rarely a whole pixel and rounding up leaves a sliver uncovered.
      var rect = el.getBoundingClientRect();
      var w = rect.width;
      var h = rect.height;
      if (!w || !h) return false;

      // Retina: draw at 2x tile density so the map isn't soft on good screens.
      //
      // ⚠️ Esri serves one 256px tile and has no @2x variant, so "2x" here
      // means twice as MANY tiles at a smaller CSS size rather than denser
      // ones. That still sharpens the result — four tiles cover the area one
      // did — and it is why the @2x filename suffix CARTO needed is gone.
      var scale = window.devicePixelRatio > 1.3 ? 2 : 1;
      var px = TILE * scale;

      // Everything below works in tile-pixel space, so the CSS dimensions have
      // to be scaled into it first. Mixing the two centred the map on w/(2*sc)
      // instead of w/2 and asked for half the tile columns needed, which left a
      // dead strip down the right edge on every retina screen.
      var vw = w * scale;
      var vh = h * scale;

      var zoom = zoomFor(h);

      var left = lonToX(LON, zoom) * px - vw / 2;
      var top = latToY(LAT, zoom) * px - vh / 2;

      // Floor on both ends covers [left, left+vw] exactly once the units agree.
      // The per-tile pixel of overlap below absorbs any float-boundary case, so
      // no extra ring of tiles is needed.
      var x0 = Math.floor(left / px), y0 = Math.floor(top / px);
      var x1 = Math.floor((left + vw) / px);
      var y1 = Math.floor((top + vh) / px);
      var max = Math.pow(2, zoom);
      var frag = document.createDocumentFragment();

      for (var ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= max) continue;
        for (var tx = x0; tx <= x1; tx++) {
          var wrapped = ((tx % max) + max) % max;
          var img = document.createElement("img");
          img.className = "origin-tile";
          img.alt = "";
          img.setAttribute("aria-hidden", "true");
          img.decoding = "async";
          img.style.left = (tx * px - left) / scale + "px";
          img.style.top = (ty * px - top) / scale + "px";
          // A pixel of overlap. Tile positions are fractional, so neighbours
          // otherwise leave hairline seams where the rounding falls apart; the
          // next tile paints over the surplus.
          img.style.width = px / scale + 1 + "px";
          img.style.height = px / scale + 1 + "px";
          // ⚠️ Esri orders its path {z}/{y}/{x} — row before column — where the
          // XYZ convention CARTO used is {z}/{x}/{y}. Swapping them silently
          // returns a valid tile from the wrong place: 11/1445/917 answers 200
          // with a grey "Map data not yet available" square rather than a 404,
          // so the map would look broken with nothing in the console.
          img.src =
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/" +
            "World_Dark_Gray_Base/MapServer/tile/" + zoom + "/" + ty +
            "/" + wrapped;
          frag.appendChild(img);
        }
      }

      Array.prototype.slice.call(el.querySelectorAll(".origin-tile")).forEach(function (n) {
        n.remove();
      });
      el.insertBefore(frag, el.firstChild);
      return true;
    }

    var built = false;

    function ensure() {
      if (built) return;
      // The contact view is hidden until routed to, so the map has no size
      // yet; only mark it built once it actually measures.
      if (build()) built = true;
    }

    var contact = document.getElementById("view-contact");
    if (contact) {
      var cmo = new MutationObserver(function () {
        if (contact.classList.contains("is-active")) {
          // Wait a frame for layout to settle after display flips.
          requestAnimationFrame(ensure);
        }
      });
      cmo.observe(contact, { attributes: true, attributeFilter: ["class"] });
      if (contact.classList.contains("is-active")) requestAnimationFrame(ensure);
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
      if (!built) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 220);
    });

    // The panel is fluid and sits below a form whose height can settle late
    // (web fonts, validation text). A window resize never fires for that, so
    // watch the element itself and re-stitch when its box actually changes.
    if (typeof ResizeObserver === "function") {
      var lastW = 0, lastH = 0, roTimer;
      new ResizeObserver(function () {
        if (!built) return;
        var r = el.getBoundingClientRect();
        if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1) return;
        lastW = r.width;
        lastH = r.height;
        clearTimeout(roTimer);
        roTimer = setTimeout(build, 120);
      }).observe(el);
    }
  })();

  /* ---------------------------- contact form ----------------------------- */

  var form = document.getElementById("contact-form");
  if (!form) return;

  var status = document.getElementById("form-status");
  var message = document.getElementById("f-message");
  var counter = document.getElementById("f-count");

  var RULES = {
    name: {
      error: "Please tell me your name.",
      test: function (v) { return v.length >= 2; }
    },
    email: {
      error: "That doesn't look like a valid email address.",
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
    },
    subject: {
      error: "A short subject helps me prioritise.",
      test: function (v) { return v.length >= 3; }
    },
    message: {
      error: "A little more detail, please — at least 10 characters.",
      test: function (v) { return v.length >= 10; }
    }
  };

  function fieldOf(input) { return input.closest(".field"); }
  function errorOf(input) { return document.getElementById("e-" + input.name); }

  function validate(input, showError) {
    var rule = RULES[input.name];
    if (!rule) return true;
    var ok = rule.test(input.value.trim());
    var field = fieldOf(input);
    var err = errorOf(input);

    if (ok) {
      field.classList.remove("has-error");
      input.removeAttribute("aria-invalid");
      if (err) { err.hidden = true; err.textContent = ""; }
      return true;
    }

    if (showError) {
      field.classList.add("has-error");
      input.setAttribute("aria-invalid", "true");
      if (err) { err.textContent = rule.error; err.hidden = false; }
    }
    return false;
  }

  function setStatus(text, kind) {
    if (!status) return;
    status.textContent = text;
    status.classList.remove("is-ok", "is-bad");
    if (kind) status.classList.add(kind);
  }

  var inputs = Array.prototype.slice.call(form.querySelectorAll("input, textarea"));

  inputs.forEach(function (input) {
    // Validate on blur; once a field is in error, correct it live as they type.
    input.addEventListener("blur", function () { validate(input, true); });
    input.addEventListener("input", function () {
      if (fieldOf(input).classList.contains("has-error")) validate(input, true);
      setStatus("", "");
    });
  });

  if (message && counter) {
    var updateCount = function () {
      counter.textContent = message.value.length + " / 2000";
    };
    message.addEventListener("input", updateCount);
    updateCount();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var firstBad = null;
    inputs.forEach(function (input) {
      if (!validate(input, true) && !firstBad) firstBad = input;
    });

    if (firstBad) {
      firstBad.focus();
      setStatus("Please fix the highlighted fields.", "is-bad");
      return;
    }

    var name = document.getElementById("f-name").value.trim();
    var email = document.getElementById("f-email").value.trim();
    var subject = document.getElementById("f-subject").value.trim();
    var body = message.value.trim();

    var composed = body + "\n\n—\n" + name + "\n" + email;

    var href =
      "mailto:" + EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(composed);

    // Some mail handlers choke well past this; keep the URL comfortably short.
    if (href.length > 1800) {
      setStatus("That message is a little long for a mail link — please trim it a little.", "is-bad");
      return;
    }

    window.location.href = href;
    setStatus("Opening your mail app…", "is-ok");
  });
})();
