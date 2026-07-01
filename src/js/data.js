const LOGO_DEV_KEY = 'pk_DfNn3uPKQ4mLB6sTzS_wGg';

function logoUrl(domain) {
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_KEY}&size=64`;
}

const PLANS = [
  { id: 'sprout', name: 'Sprout', price: 3, trees: 1, slots: 2,         perks: ['2 referral code slots', 'All service listings', '1 tree planted monthly'] },
  { id: 'grove',  name: 'Grove',  price: 5, trees: 3, slots: 5,         perks: ['5 referral code slots', 'Priority rotation weight', '3 trees planted monthly', 'Member badge'] },
  { id: 'forest', name: 'Forest', price: 9, trees: 8, slots: Infinity,  perks: ['Unlimited code slots', 'Top rotation placement', '8 trees planted monthly', 'Member badge', 'Early access'] },
];
