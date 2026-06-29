// ── SERVICES CATALOGUE ──
// Each service has a list of referral codes supplied by paying members.
// On page load, one code per service is randomly selected to display.

const SERVICES = [
  {
    id: "robinhood",
    name: "Robinhood",
    category: "Finance",
    icon: "🐦",
    color: "#00c805",
    bg: "#e6fff0",
    reward: "Get a free stock (up to $225) when you sign up",
    url: "https://robinhood.com",
    codes: []
  },
  {
    id: "coinbase",
    name: "Coinbase",
    category: "Crypto",
    icon: "₿",
    color: "#1652f0",
    bg: "#eef2ff",
    reward: "$10 in Bitcoin when you buy or sell $100+",
    url: "https://coinbase.com",
    codes: []
  },
  {
    id: "doordash",
    name: "DoorDash",
    category: "Food Delivery",
    icon: "🍕",
    color: "#ff3008",
    bg: "#fff1f0",
    reward: "50% off your first 3 orders (up to $15 each)",
    url: "https://doordash.com",
    codes: []
  },
  {
    id: "uber",
    name: "Uber",
    category: "Rides",
    icon: "🚗",
    color: "#000000",
    bg: "#f5f5f5",
    reward: "$20 off your first 2 rides",
    url: "https://uber.com",
    codes: []
  },
  {
    id: "airbnb",
    name: "Airbnb",
    category: "Travel",
    icon: "🏡",
    color: "#ff385c",
    bg: "#fff1f3",
    reward: "$50 off your first booking of $150+",
    url: "https://airbnb.com",
    codes: []
  },
  {
    id: "chime",
    name: "Chime",
    category: "Finance",
    icon: "💳",
    color: "#1da462",
    bg: "#f0fdf4",
    reward: "$100 bonus when you set up direct deposit",
    url: "https://chime.com",
    codes: []
  },
  {
    id: "rakuten",
    name: "Rakuten",
    category: "Shopping",
    icon: "🛍️",
    color: "#bf0000",
    bg: "#fff5f5",
    reward: "$30 cash back on your first $30+ purchase",
    url: "https://rakuten.com",
    codes: []
  },
  {
    id: "hinge",
    name: "Hinge",
    category: "Dating",
    icon: "💕",
    color: "#e8175d",
    bg: "#fff0f6",
    reward: "1 month of Hinge+ free",
    url: "https://hinge.co",
    codes: []
  },
  {
    id: "sofi",
    name: "SoFi",
    category: "Finance",
    icon: "🏦",
    color: "#7b4eea",
    bg: "#f5f0ff",
    reward: "Up to $325 bonus when you open an account",
    url: "https://sofi.com",
    codes: []
  },
  {
    id: "acorns",
    name: "Acorns",
    category: "Investing",
    icon: "🌰",
    color: "#4caf50",
    bg: "#f0fdf4",
    reward: "$5 bonus when you start investing",
    url: "https://acorns.com",
    codes: []
  },
  {
    id: "expensify",
    name: "Expensify",
    category: "Business",
    icon: "🧾",
    color: "#0185ff",
    bg: "#eff8ff",
    reward: "3 months free on any paid plan",
    url: "https://expensify.com",
    codes: []
  },
  {
    id: "honey",
    name: "Honey",
    category: "Shopping",
    icon: "🍯",
    color: "#e8a900",
    bg: "#fffbeb",
    reward: "500 bonus Honey Gold on first order",
    url: "https://joinhoney.com",
    codes: []
  },
];

// ── DEMO MEMBERS (simulates existing paid members) ──
const DEMO_MEMBERS = [
  { name: "Alex T.", trees: 12, joined: "Jan 2024", codes: {
    robinhood: "ALEX-RF-9821", doordash: "ALEX50OFF", airbnb: "ALEXTRAVEL22",
    chime: "ALEXCHM100", rakuten: "ALEX30CK", sofi: "ALEXSOFI25"
  }},
  { name: "Jordan M.", trees: 8, joined: "Mar 2024", codes: {
    coinbase: "JRDNBTC10", uber: "JRDNRIDE20", hinge: "JRDNHNG1MO",
    acorns: "JRDN5INV", honey: "JRDN500G"
  }},
  { name: "Sam K.", trees: 24, joined: "Oct 2023", codes: {
    robinhood: "SAM-ROB-7710", coinbase: "SAMKBTC", doordash: "SAM50DASH",
    uber: "SAMRIDEFREE", airbnb: "SAMBNB50", expensify: "SAMEXP3M"
  }},
  { name: "Riley P.", trees: 5, joined: "May 2024", codes: {
    chime: "RILEY100BANK", sofi: "RILEYSOFI", acorns: "RILEYROUNDS",
    honey: "RILEYHONEY", hinge: "RILEYDATE1"
  }},
  { name: "Morgan B.", trees: 18, joined: "Dec 2023", codes: {
    rakuten: "MORGANCASH30", expensify: "MORGANEXP", robinhood: "MORGSTOCK",
    coinbase: "MORGBTC10", uber: "MORGANRIDES"
  }},
];

// Populate service codes from demo members
DEMO_MEMBERS.forEach(member => {
  Object.entries(member.codes).forEach(([serviceId, code]) => {
    const svc = SERVICES.find(s => s.id === serviceId);
    if (svc) svc.codes.push({ code, contributor: member.name, trees: member.trees });
  });
});

const PLANS = [
  { id: "sprout",   name: "Sprout",  price: 3,  trees: 1, perks: ["1 referral code slot", "All service listings", "Monthly tree planted"] },
  { id: "grove",    name: "Grove",   price: 7,  trees: 3, perks: ["3 referral code slots", "Priority rotation", "3 trees planted monthly", "Member badge"] },
  { id: "forest",   name: "Forest",  price: 15, trees: 8, perks: ["Unlimited code slots", "Top rotation placement", "8 trees planted monthly", "Member badge", "Early access to new services"] },
];

const CATEGORIES = ["All", ...new Set(SERVICES.map(s => s.category))];
