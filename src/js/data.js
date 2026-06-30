const LOGO_DEV_KEY = 'pk_DfNn3uPKQ4mLB6sTzS_wGg';

function logoUrl(domain) {
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_KEY}&size=64`;
}

const PLANS = [
  { id: 'sprout', name: 'Sprout', price: 3,  trees: 1, perks: ['1 referral code slot', 'All service listings', 'Monthly tree planted'] },
  { id: 'grove',  name: 'Grove',  price: 7,  trees: 3, perks: ['3 referral code slots', 'Priority rotation weight', '3 trees planted monthly', 'Member badge'] },
  { id: 'forest', name: 'Forest', price: 15, trees: 8, perks: ['Unlimited code slots', 'Top rotation placement', '8 trees planted monthly', 'Member badge', 'Early access'] },
];
