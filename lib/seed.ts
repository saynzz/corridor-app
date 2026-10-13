import type { BankState } from "./types";

const DAY = 24 * 3600 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);

export function seedState(): BankState {
  return {
    version: 1,
    profile: {
      name: "Aruzhan Sadykova",
      homeCountry: "Kazakhstan",
      homeCity: "Almaty",
      studyCountry: "Singapore",
      university: "Lion City University",
      baseCurrency: "SGD",
      homeCurrency: "KZT",
    },
    wallets: [
      { currency: "SGD", balance: 1120.4, label: "Main · daily spend" },
      { currency: "KZT", balance: 912000, label: "From family" },
      { currency: "USD", balance: 480, label: "Scholarship" },
      { currency: "CNY", balance: 100, label: "Shenzhen trip" },
    ],
    payees: [
      {
        id: "p_uni",
        name: "Lion City University — Bursar",
        kind: "university",
        currency: "SGD",
        account: "SG Demo Bank •••• 7731",
        verified: true,
        verifiedVia: "Official institution registry (sandbox)",
        addedAt: iso(-60),
      },
      {
        id: "p_landlord",
        name: "Tan Wei Ming (landlord)",
        kind: "landlord",
        currency: "SGD",
        account: "SG Demo Bank •••• 4821",
        phone: "+65 8000 0000",
        verified: true,
        verifiedVia: "Tenancy agreement uploaded in August",
        addedAt: iso(-55),
      },
      {
        id: "p_mom",
        name: "Saule Sadykova (mom)",
        kind: "family",
        currency: "KZT",
        account: "KZ Demo Bank •••• 0912",
        verified: true,
        verifiedVia: "Saved family contact",
        addedAt: iso(-90),
      },
      {
        id: "p_mobile",
        name: "Orbit Mobile",
        kind: "merchant",
        currency: "SGD",
        account: "Biller code 50213",
        verified: true,
        verifiedVia: "Registered biller",
        addedAt: iso(-50),
      },
    ],
    bills: [
      {
        id: "b_tuition",
        payeeId: "p_uni",
        title: "Semester 2 tuition",
        amount: 2000,
        currency: "SGD",
        dueDate: date(3),
        reference: "LCU-2026-S2-48213",
        status: "due",
      },
      {
        id: "b_rent",
        payeeId: "p_landlord",
        title: "November rent",
        amount: 950,
        currency: "SGD",
        dueDate: date(20),
        reference: "RENT-NOV",
        status: "due",
      },
    ],
    transactions: [
      {
        id: "t_mom",
        at: iso(-0.1),
        kind: "incoming",
        title: "From Saule Sadykova (mom)",
        legs: [{ currency: "KZT", amount: 500000 }],
      },
      {
        id: "t_phone",
        at: iso(-6),
        kind: "payment",
        title: "Orbit Mobile — monthly plan",
        legs: [{ currency: "SGD", amount: -28 }],
      },
      {
        id: "t_grocery",
        at: iso(-7),
        kind: "payment",
        title: "Groceries",
        legs: [{ currency: "SGD", amount: -64.3 }],
      },
    ],
    drafts: [],
    alerts: [],
    audit: [],
    credit: [
      { id: "c1", title: "Open a local bank account", why: "Local banks report account history to the credit bureau.", done: true },
      { id: "c2", title: "Phone bill on autopay, on time", why: "On-time recurring payments are the easiest positive signal.", done: true },
      { id: "c3", title: "Student secured card", why: "A small secured limit used lightly and repaid in full builds history fast.", done: false },
      { id: "c4", title: "Keep usage under 30%", why: "Low utilisation of your credit limit improves your score.", done: false },
      { id: "c5", title: "6 months of clean history", why: "After six months most lenders can score you properly.", done: false },
    ],
    limits: {
      convertDailySGD: 5000,
      paymentSingleSGD: 3000,
      paymentMonthlySGD: 6000,
      newPayeeCoolOffHours: 24,
    },
  };
}
