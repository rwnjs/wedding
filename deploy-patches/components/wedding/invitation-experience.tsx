"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, MailOpen, RotateCcw } from "lucide-react";
import { InvitationMusic } from "@/components/wedding/invitation-music";
import styles from "./invitation-experience.module.css";

type Phase = "closed" | "opening" | "opened";

const OPENING_DURATION = 4800;

function Monogram({ small = false }: { small?: boolean }) {
  return <span className={small ? styles.smallMonogram : styles.monogram} aria-hidden="true">
    <img className={styles.monogramImage} src="/assets/nr-wedding-monogram.png" width="1254" height="1254" alt="" draggable={false} decoding="async" fetchPriority="high" />
  </span>;
}

export function InvitationExperience({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("closed");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opening = useRef(false);
  const focusAfterOpening = useRef(false);
  const focusCover = useRef(false);
  const replayed = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);

  const finishOpening = useCallback(() => {
    opening.current = false;
    setPhase("opened");
    window.dispatchEvent(new CustomEvent("wedding:opened", { detail: { replay: replayed.current } }));
  }, []);

  const replayEnvelope = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    opening.current = false;
    focusAfterOpening.current = false;
    replayed.current = true;
    focusCover.current = true;
    window.dispatchEvent(new CustomEvent("wedding:closed"));
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setPhase("closed");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: "instant" });

    const resetRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) replayEnvelope();
    };
    window.addEventListener("pageshow", resetRestoredPage);
    window.addEventListener("wedding:show-envelope", replayEnvelope);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pageshow", resetRestoredPage);
      window.removeEventListener("wedding:show-envelope", replayEnvelope);
    };
  }, [replayEnvelope]);

  useEffect(() => {
    if (phase === "opened") {
      const frame = window.requestAnimationFrame(() => {
        if (focusAfterOpening.current) {
          const target = document.getElementById("main-content");
          if (target) {
            const originalTabIndex = target.getAttribute("tabindex");
            target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
            if (originalTabIndex === null) target.removeAttribute("tabindex");
            else target.setAttribute("tabindex", originalTabIndex);
          }
          window.scrollTo({ top: 0, behavior: "instant" });
          window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
          focusAfterOpening.current = false;
        }
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (phase === "closed") {
      window.scrollTo({ top: 0, behavior: "instant" });
      if (focusCover.current) {
        openButton.current?.focus({ preventScroll: true });
        focusCover.current = false;
      }
    }
  }, [phase]);

  function openInvitation(skipAnimation = false) {
    if (opening.current || phase !== "closed") return;
    opening.current = true;
    focusAfterOpening.current = true;
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new CustomEvent("wedding:opening", { detail: { replay: replayed.current } }));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (skipAnimation || reduceMotion) { finishOpening(); return; }
    setPhase("opening");
    timer.current = setTimeout(() => { timer.current = null; finishOpening(); }, OPENING_DURATION);
  }

  return <div className={styles.experience} data-invitation-shell data-invitation-state={phase}>
    <InvitationMusic visible={phase === "opening" || phase === "opened"} />
    {(phase === "closed" || phase === "opening") && <section className={styles.cover} aria-labelledby="envelope-heading" data-opening={phase === "opening" ? "true" : undefined}>
      <div className={styles.outerRule} aria-hidden="true" />
      <div className={styles.coverHeader}>
        <p className={styles.eyebrow}>WITH LOVE, AN INVITATION</p>
        <h1 id="envelope-heading">You are invited.</h1>
        <p className={styles.coverLead}>A special day, made sweeter with you.</p>
      </div>
      <div className={styles.envelopeScene}>
        <div className={styles.envelopeShadow} aria-hidden="true" />
        <img className={styles.flowerLeft} src="/assets/florals-left.webp" width="800" height="667" alt="" fetchPriority="high" decoding="async" />
        <div className={styles.envelope} aria-hidden="true">
          <div className={styles.envelopeBack} />
          <div className={styles.letter}>
            <div className={styles.letterBorder} />
            <span className={styles.letterCaption}>TOGETHER, WITH YOU</span>
            <Monogram />
            <span className={styles.letterOrnament}>✦</span>
          </div>
          <div className={styles.foldLeft} />
          <div className={styles.foldRight} />
          <div className={styles.foldBottom} />
          <div className={styles.flap}><div className={styles.flapBack} /><div className={styles.flapFront} /></div>
          <div className={styles.seal}><div className={styles.sealRim}><Monogram small /></div></div>
        </div>
        <img className={styles.flowerRight} src="/assets/florals-right.webp" width="800" height="674" alt="" fetchPriority="high" decoding="async" />
        <button type="button" className={styles.envelopeHotspot} aria-label="Open the wedding envelope" onClick={() => openInvitation()} disabled={phase === "opening"} />
      </div>
      <div className={styles.openingControls}>
        <button ref={openButton} type="button" className={styles.openButton} onClick={() => openInvitation()} disabled={phase === "opening"}>
          <MailOpen size={17} strokeWidth={1.4} aria-hidden="true" />
          <span>{phase === "opening" ? "Opening your invitation" : "Open invitation"}</span>
          <ArrowRight size={17} strokeWidth={1.4} aria-hidden="true" />
        </button>
        <button type="button" className={styles.skipButton} onClick={() => openInvitation(true)} disabled={phase === "opening"}>Open without animation</button>
      </div>
      <span className={styles.screenReader} role="status">{phase === "opening" ? "Opening the wedding invitation." : ""}</span>
    </section>}
    {phase === "opened" && <div className={styles.invitationContent}>
      {children}
      <div className={styles.replayRow}><button type="button" className={styles.replayButton} onClick={replayEnvelope}><RotateCcw size={13} aria-hidden="true" /> View envelope again</button></div>
    </div>}
    <noscript>
      <style>{`.${styles.cover}{display:none}`}</style>
      <section className={styles.noScript}>
        <p className={styles.eyebrow}>YOU ARE INVITED</p>
        <h1>Noemelyn &amp; Rwin</h1>
        <p>Together with our families, we request the pleasure of your company at the celebration of our wedding.</p>
        <p>November 27, 2026 · 2:00 PM</p>
        <p>Lokal ng Luzon Avenue<br />Distrito ng Central</p>
        <p>Please enable JavaScript to open the complete invitation and send your RSVP.</p>
      </section>
    </noscript>
  </div>;
}
