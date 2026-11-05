export const YSWS = {
  name: "Wonders",
  fullName: "Wonders - YSWS",
  slug: "wonders",
  origin: "https://wonders.hackclub.com",
  starts: "January 1st",
  ends: "January 15th",
  startsIso: "2027-01-01",
  endsIso: "2027-01-15",
  tagline: "A Hack Club YSWS where you make something you have wanted to make, ship it, and get a surprise.",

  hcbOrg: "wonders-ysws",
  hcbUrl: "https://hcb.hackclub.com/wonders-ysws",

  access: {
    dashboardOpen: true,
    referralsOpen: true,
  },

  rates: {
    hourlyCents: 400,
    grantMaxCents: 50_000,
  },

  limits: {
    maxCollaborators: 5,
    shipAgainMinSeconds: 60 * 60,
    staleQueueHours: 72,
  },

  slack: {
    staffChannelId: "C0C6E5XN45C",
    communityChannelId: "C0BS3VD47E3",
    staleQueuePing: ["U0ARC79GEAV"],
    weeklySummaryPing: ["U0ARC79GEAV", "U07UK4S94KC"],
  },

  airtable: {
    baseId: "appNO48Yez9uXr3WO",
    tableId: "tblhePZpKLlIA3ZHh",
  },
} as const;

export function hoursValueCents(seconds: number, rateCents: number = YSWS.rates.hourlyCents): number {
  return Math.round((Math.max(0, seconds) / 3600) * rateCents);
}

export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toFixed(whole ? 0 : 2)}`;
}
