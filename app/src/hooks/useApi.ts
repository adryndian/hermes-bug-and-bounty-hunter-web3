import { useStore } from '../stores/bountyStore'
import type { Bounty, ChatMessage, ChatModel, DeepAnalysis, UserProfile } from '../types'

export function useApi() {
  const store = useStore()

  const loadBounties = async () => {
    try {
      const res = await fetch('/bounties.json')
      const data = await res.json()
      store.setBounties(data.bounties || [])
      return data
    } catch (e) {
      console.error('Failed to load bounties:', e)
      return null
    }
  }

  const loadAnalysis = async () => {
    try {
      const res = await fetch('/analysis.json')
      const data = await res.json()
      store.setAnalysis(data || {})
      return data
    } catch (e) {
      console.error('Failed to load analysis:', e)
      return null
    }
  }

  const loadStatuses = async () => {
    try {
      const res = await fetch('/db/statuses')
      const data = await res.json()
      store.setStatuses(data || {})
      return data
    } catch (e) {
      console.error('Failed to load statuses:', e)
      return null
    }
  }

  const loadBookmarks = async () => {
    try {
      const res = await fetch('/db/bookmarks')
      const data = await res.json()
      store.setBookmarks(data || [])
      return data
    } catch (e) {
      console.error('Failed to load bookmarks:', e)
      return null
    }
  }

  const loadDbContext = async () => {
    try {
      const res = await fetch('/db/context')
      const data = await res.json()
      return data?.context || ''
    } catch (e) {
      console.error('Failed to load context:', e)
      return ''
    }
  }

  const sendChat = async (messages: ChatMessage[], model: ChatModel): Promise<string> => {
    const bounties = store.bounties.slice(0, 10)
    const bountyContext = bounties.map(b => `- ${b.title} (${b.reward}, ${b.source}, deadline: ${b.deadline})`).join('\n')

    const systemPrompt = `You are a Web3 bounty hunting expert assistant. You help analyze bounties, suggest strategies, and provide guidance.

## Your Knowledge
- Blockchain fundamentals: EVM (Ethereum, Polygon, Arbitrum, Base, Optimism), Solana, DeFi protocols (Uniswap, Aave, Compound, MakerDAO), security patterns (reentrancy, flash loans, oracle manipulation)
- Bounty platforms: Immunefi (security/bug bounties), Code4rena (audit contests), Sherlock (audit contests), Superteam Earn (Solana ecosystem bounties - content, dev, design)
- Bounty hunting tactics: content bounties (articles, threads, tutorials), frontend bounties (React/Next.js dApps), audit contests (Solidity/Rust review), design bounties
- Security patterns: access control, integer overflow, reentrancy guards, proxy patterns, upgradeable contracts, flash loan attacks, price oracle manipulation
- DeFi concepts: AMMs, lending protocols, yield farming, liquid staking, restaking, bridges, L2 rollups

## User Profile
- Skills: TypeScript, React, React Native, Next.js, full-stack development, content writing (Bahasa Indonesia & English)
- Strengths: Frontend development, technical writing, rapid prototyping
- Learning: Solidity, smart contract security, Rust (Solana)

## Analysis Framework
When analyzing bounties, consider:
1. Skill match (0-100): How well user's skills match requirements
2. Time estimate: Realistic hours/days needed
3. Competition level: How many others likely competing
4. ROI: Reward vs effort ratio
5. Learning value: New skills gained

## Active Bounties Context
${bountyContext}

Respond concisely and actionably. Use Bahasa Indonesia if the user writes in Indonesian.`

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ]

    const res = await fetch('/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        stream: false,
      })
    })

    if (!res.ok) throw new Error(`Chat API error: ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || 'No response'
  }

  const fetchBountyDetail = async (url: string): Promise<string> => {
    try {
      const res = await fetch(`/api/fetch-bounty-detail?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      return data.ok ? data.content : ''
    } catch {
      return ''
    }
  }

  const loadUserProfile = async () => {
    try {
      const res = await fetch('/db/user-profile')
      return await res.json()
    } catch {
      return null
    }
  }

  const saveUserProfile = async (profile: UserProfile) => {
    try {
      await fetch('/db/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      })
    } catch (e) {
      console.error('Failed to save profile:', e)
    }
  }

  const deepAnalyze = async (bounty: Bounty): Promise<DeepAnalysis> => {
    // 1. Fetch bounty page detail
    const detail = await fetchBountyDetail(bounty.url)

    // 2. Load user profile
    const profile = await loadUserProfile()
    const skills = profile?.skills?.join(', ') || 'TypeScript, React, Content Writing'
    const level = profile?.experience_level || 'intermediate'
    const focusAreas = profile?.focus_areas?.join(', ') || 'Frontend, Content'
    const notes = profile?.notes || ''

    // 3. Cross-bounty context from existing analysis
    const existingAnalysis = store.analysis
    const analyzed = Object.values(existingAnalysis)
    const skipCount = analyzed.filter((a: any) => a.verdict === 'skip').length
    const recCount = analyzed.filter((a: any) => a.verdict === 'recommended').length
    const crossContext = analyzed.length > 0
      ? `Previously analyzed ${analyzed.length} bounties: ${recCount} recommended, ${skipCount} skipped.`
      : ''

    const prompt = `Analyze this Web3 bounty for a developer with the following profile:

USER PROFILE:
- Skills: ${skills}
- Experience: ${level}
- Focus areas: ${focusAreas}
- Notes: ${notes}

${crossContext ? `CROSS-BOUNTY CONTEXT:\n${crossContext}\n` : ''}
BOUNTY:
- Title: ${bounty.title}
- Source: ${bounty.source}
- Sponsor: ${bounty.sponsor || 'Unknown'}
- Reward: ${bounty.reward}
- Deadline: ${bounty.deadline || 'No deadline'}
- Type: ${bounty.type}
- Category: ${bounty.category}
- URL: ${bounty.url}
${detail ? `\nBOUNTY DETAILS (scraped):\n${detail}` : ''}

Provide analysis in this exact JSON format (no markdown, raw JSON only):
{
  "match_score": <0-10>,
  "difficulty": "<easy|medium|hard|expert>",
  "time_estimate": "<e.g. 2-3 days>",
  "summary": "<1-2 sentence summary>",
  "strategy": "<recommended approach>",
  "skills_needed": ["<skill1>", "<skill2>"],
  "verdict": "<recommended|possible|skip>",
  "about": "<what this project is about>",
  "mission": "<what the bounty wants to achieve>",
  "scope": "<deliverables and scope>",
  "submission_requirements": "<format and requirements>",
  "judging_criteria": "<how evaluated>",
  "tasks": ["<specific task 1>", "<specific task 2>", "<specific task 3>", "<specific task 4>", "<specific task 5>"]
}

Be specific and realistic. Tasks should be concrete action steps for THIS bounty.`

    const res = await fetch('/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'default',
        messages: [
          { role: 'system', content: 'You are a Web3 bounty analysis expert. Respond ONLY with valid JSON, no markdown, no extra text.' },
          { role: 'user', content: prompt }
        ],
        stream: false,
      })
    })

    if (!res.ok) throw new Error(`Analysis API error: ${res.status}`)
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    let parsed: DeepAnalysis
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        match_score: 5,
        difficulty: 'medium',
        time_estimate: 'unknown',
        summary: content.slice(0, 200),
        strategy: 'Review the bounty requirements carefully',
        skills_needed: ['TypeScript'],
        verdict: 'possible',
        about: 'Unable to parse full analysis',
        mission: 'See bounty page for details',
        scope: 'See bounty page for details',
        submission_requirements: 'See bounty page for details',
        judging_criteria: 'See bounty page for details',
        tasks: ['Review bounty requirements', 'Research the project', 'Plan submission', 'Execute', 'Submit']
      }
    }

    return parsed
  }

  const loadAll = async () => {
    await Promise.all([
      loadBounties(),
      loadAnalysis(),
      loadStatuses(),
      loadBookmarks(),
    ])
    // Restore analysis from persisted drafts (survives refresh)
    const drafts = JSON.parse(localStorage.getItem('bounty-drafts') || '{}')
    const currentAnalysis = store.analysis
    const merged = { ...currentAnalysis }
    for (const [id, draft] of Object.entries(drafts) as [string, any][]) {
      if (draft.match_score !== undefined && !merged[id]) {
        merged[id] = {
          match_score: draft.match_score,
          difficulty: draft.difficulty,
          time_estimate: draft.time_estimate,
          summary: draft.summary,
          strategy: draft.strategy,
          skills_needed: draft.skills_needed,
          verdict: draft.verdict,
        }
      }
    }
    if (Object.keys(merged).length > Object.keys(currentAnalysis).length) {
      store.setAnalysis(merged)
    }

    // Hydrate workspace drafts from DB analysis for bounties with status
    // This ensures workspace survives page refresh
    const statuses = store.statuses
    const analysis = store.analysis
    const existingDrafts = store.drafts
    for (const [bountyId, status] of Object.entries(statuses)) {
      if (!existingDrafts[bountyId] && analysis[bountyId]) {
        const a = analysis[bountyId] as any
        store.setDraft(bountyId, {
          match_score: a.match_score,
          difficulty: a.difficulty,
          time_estimate: a.time_estimate,
          summary: a.summary,
          strategy: a.strategy,
          skills_needed: a.skills_needed,
          verdict: a.verdict,
          tasks: a.tasks || [],
        })
      }
    }
  }

  return {
    loadBounties,
    loadAnalysis,
    loadStatuses,
    loadBookmarks,
    loadDbContext,
    sendChat,
    deepAnalyze,
    loadAll,
    fetchBountyDetail,
    loadUserProfile,
    saveUserProfile,
  }
}
