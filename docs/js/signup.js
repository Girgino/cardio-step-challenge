// The two-step join guide. Progress is remembered on this phone so people can
// install Pacer and come back to the same tab later.
import { $, h, store } from "./util.js";
import { SITE } from "./content.js";

export function detectOS() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

let built = false;
export function renderJoin(ctx) {
  const key = (ctx.ns || "") + "signup";
  const st = store.get(key, { step: 1 });
  const os = ctx.forceOS || detectOS();
  const wrap = $("#steps");
  if (built && wrap.dataset.step === String(st.step)) return;
  built = true;
  wrap.dataset.step = st.step;

  const storeBtn = (which) => which === "ios"
    ? h("a", { class: "store", href: SITE.appStore, target: "_blank", rel: "noopener" }, svgUse("i-apple"), h("span", {}, h("small", { text: "Download Pacer on the" }), h("b", { text: "App Store" })))
    : h("a", { class: "store", href: SITE.playStore, target: "_blank", rel: "noopener" }, svgUse("i-play"), h("span", {}, h("small", { text: "Get Pacer on" }), h("b", { text: "Google Play" })));

  const signIn = os === "android" ? "Continue with Google" : "Continue with Apple or Continue with Google";
  const health = os === "android"
    ? [h("b", { text: "Allow activity access." }), " When Pacer asks for Physical activity or Health Connect, tap Allow."]
    : os === "ios" ? [h("b", { text: "Allow Apple Health." }), " When the Health screen appears, tap Turn On All, then Allow."]
    : [h("b", { text: "Allow Health access" }), " (Apple Health on iPhone, Health Connect on Android)."];

  const done1 = st.step >= 2;
  const step1 = h("div", { class: "card step" + (done1 ? " done" : ""), "data-reveal": "" },
    h("div", { class: "n" }, h("i", { text: done1 ? "✓" : "1" }), "Step 1"),
    h("h3", { text: "Get Pacer and sign in" }),
    h("p", { text: "Pacer is a free step-counting app. It reads your phone or watch in the background." }),
    h("div", { class: "stores" }, ...(os === "desktop" ? [storeBtn("ios"), storeBtn("android")] : [storeBtn(os)])),
    h("ol", {},
      h("li", {}, h("span", {}, h("b", { text: "Open Pacer and sign in first." }), ` Choose ${signIn}. Don't skip this, even if Pacer lets you.`)),
      h("li", {}, h("span", {}, h("b", { text: "Remember which one you picked." }), " You'll pick the same one in step 2.")),
      h("li", {}, h("span", {}, ...health))),
    done1 ? h("p", { class: "fine", text: "Done. Now step 2." }) :
      h("button", { type: "button", class: "btn", text: "Done. I'm signed in to Pacer", onclick: () => { store.set(key, { step: 2, os, at: Date.now() }); renderJoin(ctx); scrollToStep2(ctx); } }));

  const c1 = h("input", { type: "checkbox" }), c2 = h("input", { type: "checkbox" });
  const go = h("a", { class: "btn", href: SITE.supabaseUrl + "/functions/v1/auth-start", "aria-disabled": "true", text: "Connect Pacer",
    onclick: () => store.set(key, { ...store.get(key, {}), step: 2, tapped: Date.now() }) });
  if (ctx.demo) go.setAttribute("href", "?demo=joined#joined");
  const sync = () => go.setAttribute("aria-disabled", c1.checked && c2.checked ? "false" : "true");
  c1.addEventListener("change", sync); c2.addEventListener("change", sync);

  const step2 = h("div", { class: "card step" + (done1 ? "" : " locked"), id: "step2", "data-reveal": "" },
    h("div", { class: "n" }, h("i", { text: "2" }), "Step 2"),
    h("h3", { text: "Come back here and connect" }),
    h("p", { text: "Return to this browser tab. Tick both boxes, then tap Connect Pacer." }),
    h("div", { class: "checks" },
      h("label", { class: "check" }, c1, h("span", { text: os === "android" ? "I signed in to Pacer with Google" : "I signed in to Pacer with Apple or Google" })),
      h("label", { class: "check" }, c2, h("span", { text: "I allowed Health access" }))),
    go,
    h("p", { class: "fine" }, h("b", { text: "On the Pacer screen, pick the same sign-in you used in the app" }), ", then tap Approve. You'll come straight back here."),
    h("details", { class: "help" }, h("summary", { text: "Trouble?" }),
      h("p", { text: "If your steps show 0 after a few minutes, you probably picked a different sign-in than in the app. Tap Connect Pacer again and choose the other one." }),
      h("p", { text: "If Pacer never asked you to sign in, open your profile in Pacer, sign in there, then come back and connect." }),
      h("p", { text: "Still stuck? Find someone from the Cardiology Club. It takes a minute to sort out." })));

  const parts = [step1, step2];
  if (os === "desktop") {
    parts.push(h("div", { class: "card step joinside", style: "grid-column:1/-1;grid-template-columns:auto 1fr;align-items:center;gap:20px" },
      h("div", { class: "qr" }, h("img", { src: "assets/join-qr.svg", alt: "QR code for this page" })),
      h("div", {}, h("h3", { text: "Do this on your phone" }), h("p", { text: "Pacer counts steps from the phone you carry. Scan this code with your phone's camera to open this page there." }))));
  }
  wrap.replaceChildren(...parts);
  ctx.motion?.scan(true);
}

function svgUse(id) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<use href="#${id}"/>`;
  return s;
}
function scrollToStep2(ctx) {
  const el = $("#step2");
  if (!el) return;
  ctx.motion?.scrollTo(el);
}

export const clearSignup = (ns = "") => store.del(ns + "signup");
