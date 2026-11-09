import fs from 'node:fs';
import path from 'node:path';

const componentPath = path.join(process.cwd(), 'components/wedding/wedding-countdown.tsx');
fs.writeFileSync(componentPath, `"use client";

import { useEffect, useState } from "react";

const WEDDING_TIME = new Date("2026-11-27T14:00:00+08:00").getTime();

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

function getTimeLeft(now: number): TimeLeft {
  const distance = Math.max(0, WEDDING_TIME - now);
  const totalSeconds = Math.floor(distance / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: distance <= 0,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function WeddingCountdown() {
  const [time, setTime] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const update = () => setTime(getTimeLeft(Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (time?.done) {
    return (
      <div className="wedding-countdown wedding-countdown-complete">
        <p className="countdown-kicker">THE WAIT IS OVER</p>
        <p className="countdown-complete-message">Today, our forever begins.</p>
      </div>
    );
  }

  const values = [
    ["Days", time ? String(time.days) : "--"],
    ["Hours", time ? pad(time.hours) : "--"],
    ["Minutes", time ? pad(time.minutes) : "--"],
    ["Seconds", time ? pad(time.seconds) : "--"],
  ];

  const label = time
    ? time.days + " days, " + time.hours + " hours, " + time.minutes + " minutes, and " + time.seconds + " seconds until the wedding"
    : "Wedding countdown loading";

  return (
    <div className="wedding-countdown" role="timer" aria-label={label}>
      <p className="countdown-kicker">COUNTING DOWN TO FOREVER</p>
      <div className="countdown-grid" aria-hidden="true">
        {values.map(([unit, value]) => (
          <div className="countdown-unit" key={unit}>
            <strong className="countdown-value">{value}</strong>
            <span className="countdown-label">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
`);

const pagePath = path.join(process.cwd(), 'app/page.tsx');
let page = fs.readFileSync(pagePath, 'utf8');

if (!page.includes('WeddingCountdown')) {
  page = page.replace(
    'import { GiftAccounts } from "@/components/wedding/gift-accounts";',
    'import { GiftAccounts } from "@/components/wedding/gift-accounts";\nimport { WeddingCountdown } from "@/components/wedding/wedding-countdown";',
  );

  const marker = `          <div className="hero-date" aria-label="November 27, 2026, at 2:00 PM">
            <span className="date-month">November</span><strong>27</strong><span className="date-year">2026</span><span className="date-divider" aria-hidden="true" /><span className="date-time">2:00 PM</span>
          </div>`;

  if (!page.includes(marker)) throw new Error('Countdown placement target not found');

  page = page.replace(
    marker,
    marker + '\n          <WeddingCountdown />',
  );
  fs.writeFileSync(pagePath, page);
}

const cssPath = path.join(process.cwd(), 'app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');

if (!css.includes('/* Wedding countdown */')) {
  css += `

/* Wedding countdown */
.wedding-countdown {
  width: min(620px, 100%);
  margin: 22px auto 20px;
  text-align: center;
}

.countdown-kicker {
  margin: 0 0 10px;
  color: #9a6a2f;
  font: 600 10px/1.2 Arial, Helvetica, sans-serif;
  letter-spacing: .22em;
}

.countdown-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.countdown-unit {
  min-width: 0;
  padding: 10px 8px 9px;
  border-top: 1px solid rgba(154, 106, 47, .42);
  border-bottom: 1px solid rgba(154, 106, 47, .42);
  background: rgba(255, 253, 248, .68);
  backdrop-filter: blur(3px);
}

.countdown-value {
  display: block;
  color: #102b41;
  font: 400 clamp(28px, 4vw, 42px)/1 Georgia, "Times New Roman", serif;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}

.countdown-label {
  display: block;
  margin-top: 6px;
  color: #6a7881;
  font: 600 9px/1.2 Arial, Helvetica, sans-serif;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.wedding-countdown-complete {
  padding: 10px 0 4px;
}

.countdown-complete-message {
  margin: 0;
  color: #102b41;
  font: 400 clamp(22px, 3vw, 30px)/1.25 Georgia, "Times New Roman", serif;
}

@media (max-width: 640px) {
  .wedding-countdown {
    width: min(100%, 360px);
    margin: 17px auto 16px;
  }

  .countdown-grid {
    gap: 5px;
  }

  .countdown-unit {
    padding: 8px 4px 7px;
  }

  .countdown-value {
    font-size: clamp(24px, 8.5vw, 34px);
  }

  .countdown-label {
    margin-top: 5px;
    font-size: 8px;
    letter-spacing: .1em;
  }

  .countdown-kicker {
    margin-bottom: 8px;
    font-size: 9px;
  }
}
`;
  fs.writeFileSync(cssPath, css);
}

console.log('Wedding countdown enabled for November 27, 2026 at 2:00 PM Asia/Manila.');
