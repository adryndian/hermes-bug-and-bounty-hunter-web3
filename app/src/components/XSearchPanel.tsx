const SEARCH_LINKS = [
  // === Platform Accounts ===
  {
    title: 'Superteam Bounties',
    query: 'from:SuperteamEarn bounty OR grant OR listing',
    category: 'platforms',
  },
  {
    title: 'Immunefi Bug Bounties',
    query: 'from:immunefi new OR launch OR bounty',
    category: 'platforms',
  },
  {
    title: 'Code4rena Contests',
    query: 'from:code4rena contest OR audit OR live',
    category: 'platforms',
  },
  {
    title: 'Sherlock Audits',
    query: 'from:shaboratory audit OR contest OR live',
    category: 'platforms',
  },
  {
    title: 'Hats Finance',
    query: 'from:HatsFinance audit OR bounty OR competition',
    category: 'platforms',
  },
  {
    title: 'Cantina Audits',
    query: 'from:cantaboratory contest OR audit',
    category: 'platforms',
  },
  {
    title: 'Gitcoin Grants',
    query: 'from:gitcoin grant OR round OR bounty',
    category: 'platforms',
  },
  {
    title: 'Layer3 Quests',
    query: 'from:layer3xyz quest OR bounty OR reward',
    category: 'platforms',
  },
  {
    title: 'Dework Tasks',
    query: 'from:daboratory bounty OR task OR open',
    category: 'platforms',
  },
  {
    title: 'Replit Bounties',
    query: 'from:Replit bounty OR challenge',
    category: 'platforms',
  },

  // === Ecosystem ===
  {
    title: 'Solana Ecosystem',
    query: '(solana OR $SOL OR @solaboratory) (bounty OR grant OR hackathon) -scam -airdrop',
    category: 'ecosystem',
  },
  {
    title: 'Ethereum / EVM',
    query: '(ethereum OR EVM OR solidity) (bounty OR grant OR audit) -scam',
    category: 'ecosystem',
  },
  {
    title: 'Arbitrum / Optimism / Base',
    query: '(arbitrum OR optimism OR base OR @arbitrum OR @Optimism) (bounty OR grant OR hackathon)',
    category: 'ecosystem',
  },
  {
    title: 'Polygon / zkEVM',
    query: '(polygon OR @0xPolygon OR zkEVM) (bounty OR grant OR hackathon)',
    category: 'ecosystem',
  },
  {
    title: 'Cosmos / IBC',
    query: '(cosmos OR @cosmos OR IBC OR cosmwasm) (bounty OR grant OR hackathon)',
    category: 'ecosystem',
  },
  {
    title: 'Sui / Aptos / Move',
    query: '(sui OR aptos OR move lang) (bounty OR grant OR hackathon)',
    category: 'ecosystem',
  },

  // === Type ===
  {
    title: 'Bug Bounty Programs',
    query: '(bug bounty OR vulnerability OR security) (crypto OR web3 OR defi) (reward OR payout) -scam',
    category: 'type',
  },
  {
    title: 'Content Bounties',
    query: '(content OR writing OR article OR thread) (bounty OR grant) (crypto OR web3) -scam',
    category: 'type',
  },
  {
    title: 'Frontend / Dev Bounties',
    query: '(frontend OR react OR typescript OR nextjs) (bounty OR grant) (crypto OR web3 OR dapp)',
    category: 'type',
  },
  {
    title: 'Design Bounties',
    query: '(design OR UI OR UX OR figma) (bounty OR grant OR contest) (crypto OR web3)',
    category: 'type',
  },
  {
    title: 'Smart Contract Audits',
    query: '(smart contract OR solidity OR audit) (contest OR bounty OR reward) -scam',
    category: 'type',
  },
  {
    title: 'Hackathons',
    query: '(hackathon OR buildathon OR hacker house) (crypto OR web3 OR blockchain) (prize OR reward)',
    category: 'type',
  },
  {
    title: 'DeFi Bounties',
    query: '(defi OR lending OR AMM OR DEX) (bounty OR grant OR integration) -scam',
    category: 'type',
  },
  {
    title: 'DAO Contributions',
    query: '(dao OR governance OR contributor) (bounty OR grant OR open role) web3',
    category: 'type',
  },
  {
    title: 'NFT & Gaming',
    query: '(nft OR gaming OR metaverse OR gamefi) (bounty OR grant OR contest) -scam',
    category: 'type',
  },
  {
    title: 'AI x Crypto',
    query: '(AI OR "artificial intelligence" OR LLM OR agent) (crypto OR web3 OR blockchain) (bounty OR grant OR hackathon)',
    category: 'type',
  },

  // === General Discovery ===
  {
    title: 'New Bounty Announcements',
    query: '(bounty OR grant OR hackathon) (crypto OR web3 OR blockchain) (announcing OR launched OR live OR open) -scam -airdrop',
    category: 'discovery',
  },
  {
    title: 'High Reward ($10K+)',
    query: '(bounty OR reward OR prize) (crypto OR web3) ("$10" OR "$20" OR "$50" OR "$100") -scam -airdrop',
    category: 'discovery',
  },
  {
    title: 'Closing Soon',
    query: '(bounty OR contest OR hackathon) (crypto OR web3) (deadline OR "last day" OR "ends soon" OR "closing") -scam',
    category: 'discovery',
  },
  {
    title: 'Japanese Web3',
    query: '(web3 OR crypto OR blockchain) (バウンティ OR 報酬 OR ハッカソン OR bounty) lang:ja',
    category: 'discovery',
  },
  {
    title: 'Indonesian Web3',
    query: '(web3 OR crypto OR blockchain) (bounty OR hadiah OR hackathon) lang:id',
    category: 'discovery',
  },
]

const CATEGORIES = [
  { id: 'platforms', label: 'Platforms', icon: '🏢' },
  { id: 'ecosystem', label: 'Ecosystem', icon: '🌐' },
  { id: 'type', label: 'By Type', icon: '🎯' },
  { id: 'discovery', label: 'Discovery', icon: '🔍' },
]

export default function XSearchPanel() {
  return (
    <div className="container x-search-container">
      <div className="section-label">X / Twitter Bounty Search</div>
      {CATEGORIES.map(cat => (
        <div key={cat.id} className="x-category">
          <div className="x-category-header">
            <span className="x-category-icon">{cat.icon}</span>
            <span className="x-category-label">{cat.label}</span>
            <span className="x-category-count">
              {SEARCH_LINKS.filter(l => l.category === cat.id).length}
            </span>
          </div>
          <div className="x-grid">
            {SEARCH_LINKS.filter(l => l.category === cat.id).map((link, idx) => (
              <a
                key={idx}
                className="x-btn"
                href={`https://x.com/search?q=${encodeURIComponent(link.query)}&f=live`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="xi">𝕏</span>
                <span>{link.title}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
