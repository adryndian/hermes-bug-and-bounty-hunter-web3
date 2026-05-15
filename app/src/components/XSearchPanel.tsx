const SEARCH_LINKS = [
  {
    title: 'Bounty Announcements',
    query: '(bounty OR grant OR hackathon) (crypto OR web3 OR blockchain) announcement',
  },
  {
    title: 'Superteam Bounties',
    query: 'from:SuperteamEarn OR "superteam earn" bounty',
  },
  {
    title: 'Immunefi Bug Bounties',
    query: 'from:immunefi OR "immunefi" new bounty',
  },
  {
    title: 'Code4rena Contests',
    query: 'from:code4rena OR "code4rena" contest audit',
  },
  {
    title: 'Sherlock Audits',
    query: 'from:shaboratory OR "sherlock" audit contest',
  },
  {
    title: 'DeFi Bounties',
    query: '(defi OR "decentralized finance") (bounty OR grant) hiring',
  },
  {
    title: 'Solana Ecosystem',
    query: '(solana OR $SOL) (bounty OR grant OR hackathon) -scam',
  },
  {
    title: 'Content Bounties',
    query: '(content OR writing OR article) (bounty OR grant) (crypto OR web3)',
  },
  {
    title: 'Frontend/Dev Bounties',
    query: '(frontend OR react OR typescript) (bounty OR grant) (crypto OR web3 OR dapp)',
  },
  {
    title: 'Layer 2 Opportunities',
    query: '(arbitrum OR optimism OR base OR polygon) (bounty OR grant OR hackathon)',
  },
  {
    title: 'NFT & Gaming',
    query: '(nft OR gaming OR metaverse) (bounty OR grant) web3',
  },
  {
    title: 'DAO Contributions',
    query: '(dao OR governance) (bounty OR contributor OR grant) open',
  },
]

export default function XSearchPanel() {
  return (
    <div className="container">
      <div className="section-label">X / Twitter Search Queries</div>
      <div className="x-grid">
        {SEARCH_LINKS.map((link, idx) => (
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
  )
}
