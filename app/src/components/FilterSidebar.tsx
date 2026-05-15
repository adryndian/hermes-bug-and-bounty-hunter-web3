import { useEffect, useRef, useState } from 'react'
import { useStore } from '../stores/bountyStore'

// ── helpers ──────────────────────────────────────────────────────────────────

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

// ── component ─────────────────────────────────────────────────────────────────

export default function FilterSidebar() {
  const bounties        = useStore(s => s.bounties)
  const analysis        = useStore(s => s.analysis)

  const filterCategory  = useStore(s => s.filterCategory)
  const filterType      = useStore(s => s.filterType)
  const filterVerdict   = useStore(s => s.filterVerdict)
  const filterRewardMin = useStore(s => s.filterRewardMin)
  const filterRewardMax = useStore(s => s.filterRewardMax)

  const setFilterCategory  = useStore(s => s.setFilterCategory)
  const setFilterType      = useStore(s => s.setFilterType)
  const setFilterVerdict   = useStore(s => s.setFilterVerdict)
  const setFilterRewardMin = useStore(s => s.setFilterRewardMin)
  const setFilterRewardMax = useStore(s => s.setFilterRewardMax)
  const clearFilters       = useStore(s => s.clearFilters)

  // Local controlled inputs for reward range (debounced)
  const [minInput, setMinInput] = useState(filterRewardMin !== null ? String(filterRewardMin) : '')
  const [maxInput, setMaxInput] = useState(filterRewardMax !== null ? String(filterRewardMax) : '')

  const minTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local inputs if store resets (e.g. clearFilters)
  useEffect(() => {
    if (filterRewardMin === null) setMinInput('')
  }, [filterRewardMin])

  useEffect(() => {
    if (filterRewardMax === null) setMaxInput('')
  }, [filterRewardMax])

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setMinInput(raw)
    if (minTimer.current) clearTimeout(minTimer.current)
    minTimer.current = setTimeout(() => {
      const n = parseFloat(raw)
      setFilterRewardMin(isNaN(n) ? null : n)
    }, 300)
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setMaxInput(raw)
    if (maxTimer.current) clearTimeout(maxTimer.current)
    maxTimer.current = setTimeout(() => {
      const n = parseFloat(raw)
      setFilterRewardMax(isNaN(n) ? null : n)
    }, 300)
  }

  // ── dynamic counts ──────────────────────────────────────────────────────────

  const countCategory = (cat: string) =>
    bounties.filter(b => b.category === cat).length

  const countType = (type: string) =>
    bounties.filter(b => b.type === type).length

  const countVerdict = (verdict: string) =>
    Object.values(analysis).filter(a => a.verdict === verdict).length

  // ── active filter check ─────────────────────────────────────────────────────

  const hasFilters =
    filterCategory.length > 0 ||
    filterType.length > 0 ||
    filterVerdict.length > 0 ||
    filterRewardMin !== null ||
    filterRewardMax !== null

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <aside className="filter-sidebar">

      {/* CATEGORY */}
      <div className="filter-section">
        <div className="filter-section-title">Category</div>

        {([
          { value: 'dev',            label: 'Development' },
          { value: 'smart-contract', label: 'Smart Contract' },
        ] as const).map(({ value, label }) => (
          <label key={value} className="filter-item">
            <input
              type="checkbox"
              className="filter-checkbox"
              checked={filterCategory.includes(value)}
              onChange={() => setFilterCategory(toggle(filterCategory, value))}
            />
            <span>
              {label}
              <span className="filter-count"> ({countCategory(value)})</span>
            </span>
          </label>
        ))}
      </div>

      {/* TYPE */}
      <div className="filter-section">
        <div className="filter-section-title">Type</div>

        {([
          { value: 'bounty',     label: 'Bounty' },
          { value: 'bug-bounty', label: 'Bug Bounty' },
        ] as const).map(({ value, label }) => (
          <label key={value} className="filter-item">
            <input
              type="checkbox"
              className="filter-checkbox"
              checked={filterType.includes(value)}
              onChange={() => setFilterType(toggle(filterType, value))}
            />
            <span>
              {label}
              <span className="filter-count"> ({countType(value)})</span>
            </span>
          </label>
        ))}
      </div>

      {/* AI VERDICT */}
      <div className="filter-section">
        <div className="filter-section-title">AI Verdict</div>

        {([
          { value: 'recommended', label: 'Recommended' },
          { value: 'possible',    label: 'Possible' },
          { value: 'skip',        label: 'Skip' },
        ] as const).map(({ value, label }) => (
          <label key={value} className="filter-item">
            <input
              type="checkbox"
              className="filter-checkbox"
              checked={filterVerdict.includes(value)}
              onChange={() => setFilterVerdict(toggle(filterVerdict, value))}
            />
            <span>
              {label}
              <span className="filter-count"> ({countVerdict(value)})</span>
            </span>
          </label>
        ))}
      </div>

      {/* REWARD RANGE */}
      <div className="filter-section">
        <div className="filter-section-title">Reward Range</div>
        <div className="filter-range">
          <input
            type="number"
            className="filter-range-input"
            placeholder="0"
            min={0}
            value={minInput}
            onChange={handleMinChange}
            aria-label="Minimum reward in USD"
          />
          <span className="filter-range-sep">–</span>
          <input
            type="number"
            className="filter-range-input"
            placeholder="Any"
            min={0}
            value={maxInput}
            onChange={handleMaxChange}
            aria-label="Maximum reward in USD"
          />
        </div>
        <div className="filter-range-label">USD</div>
      </div>

      {/* CLEAR */}
      {hasFilters && (
        <button className="filter-clear-btn" onClick={clearFilters}>
          Clear Filters
        </button>
      )}

    </aside>
  )
}
