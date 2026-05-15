import { useState, useEffect, useRef } from 'react'
import type { UserProfile } from '../types'

const FOCUS_OPTIONS = ['Frontend', 'Backend', 'Smart Contract', 'Content', 'Design', 'Security']

interface Props {
  onClose: () => void
}

export default function UserProfileModal({ onClose }: Props) {
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [level, setLevel] = useState<UserProfile['experience_level']>('intermediate')
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/db/user-profile')
      .then(r => r.json())
      .then((data: UserProfile) => {
        if (!data) return
        setSkills(data.skills || [])
        setLevel(data.experience_level || 'intermediate')
        setFocusAreas(data.focus_areas || [])
        setNotes(data.notes || '')
      })
      .catch(() => {})
  }, [])

  const addSkill = () => {
    const s = skillInput.trim()
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
    setSkillInput('')
    inputRef.current?.focus()
  }

  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s))

  const toggleFocus = (area: string) => {
    setFocusAreas(prev =>
      prev.includes(area) ? prev.filter(x => x !== area) : [...prev, area]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    const profile: UserProfile = {
      skills,
      experience_level: level,
      languages: [],
      focus_areas: focusAreas,
      notes,
    }
    try {
      await fetch('/db/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1000)
    } catch (e) {
      console.error('Failed to save profile:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-panel">
      {/* Header */}
      <div className="profile-panel-header">
        <span className="profile-panel-title">USER PROFILE</span>
        <button className="profile-panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="profile-panel-body">
        {/* Skills */}
        <div className="profile-field">
          <label className="profile-label">SKILLS</label>
          <div className="profile-tags">
            {skills.map(s => (
              <span key={s} className="profile-tag">
                {s}
                <button className="profile-tag-remove" onClick={() => removeSkill(s)}>×</button>
              </span>
            ))}
          </div>
          <div className="profile-skill-input-row">
            <input
              ref={inputRef}
              className="profile-input"
              placeholder="Add skill + Enter"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
            />
            <button className="profile-add-btn" onClick={addSkill}>+</button>
          </div>
        </div>

        {/* Experience level */}
        <div className="profile-field">
          <label className="profile-label">EXPERIENCE</label>
          <select
            className="profile-select"
            value={level}
            onChange={e => setLevel(e.target.value as UserProfile['experience_level'])}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Focus areas */}
        <div className="profile-field">
          <label className="profile-label">FOCUS AREAS</label>
          <div className="profile-focus-grid">
            {FOCUS_OPTIONS.map(area => (
              <label key={area} className={`profile-focus-item ${focusAreas.includes(area) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={focusAreas.includes(area)}
                  onChange={() => toggleFocus(area)}
                  style={{ display: 'none' }}
                />
                {area}
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="profile-field">
          <label className="profile-label">NOTES</label>
          <textarea
            className="profile-textarea"
            placeholder="Additional context for AI analysis..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="profile-panel-footer">
        <button className="profile-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
