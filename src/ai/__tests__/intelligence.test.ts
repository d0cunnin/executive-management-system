import { describe, expect, it } from 'vitest'
import { buildSeed } from '../../data/seed'
import {
  classifyCapture, evaluateIdea, incomeSummary, iNeedToHandle, monetizationScan, moveAreaForward, moveProjectForward,
  needsAttention, related, whatNext,
} from '../intelligence'

const db = buildSeed()

describe('quick capture', () => {
  it('treats “need to create a workbook” as an idea with income potential, not a chore', () => {
    const c = classifyCapture('Need to create a workbook for Faith + Mental Health 101')
    expect(c.type).toBe('idea')
    expect(c.areaId).toBe('area_dbm')
    expect(c.incomeSignal).toBe(true)
    expect(c.possibleProject).toMatch(/workbook/i)
  })
  it('files errands as personal to-dos', () => {
    const c = classifyCapture('Renew my car insurance')
    expect(c.type).toBe('task')
    expect(c.areaId).toBe('area_personal')
  })
  it('recognizes summit work', () => {
    expect(classifyCapture('Email the sponsor about the booth').areaId).toBe('area_summit')
  })
})

describe('today', () => {
  it('keeps the personal list short and only for D’Andrea', () => {
    const mine = iNeedToHandle(db)
    expect(mine.length).toBeLessThanOrEqual(5)
    expect(mine.every((t) => t.mode === 'me' && t.status !== 'waiting')).toBe(true)
  })
  it('flags the stalled Summit campaign', () => {
    expect(needsAttention(db).some((a) => a.key === 'p_summit_reg')).toBe(true)
  })
  it('never counts estimates as received income', () => {
    const s = incomeSummary(db)
    const actual = db.income.filter((i) => i.certainty === 'actual').reduce((n, i) => n + i.amount, 0)
    expect(s.receivedLast90).toBeLessThanOrEqual(actual)
    expect(s.estimate).toBeGreaterThan(0)
  })
})

describe('move this forward', () => {
  it('names the real blocker and offers AI work for the Summit campaign', () => {
    const p = db.projects.find((x) => x.id === 'p_summit_reg')!
    const plan = moveProjectForward(db, p)
    expect(plan.headline).toMatch(/campaign message/i)
    expect(plan.aiCanDo.some((a) => a.skill === 'social_posts' && a.consequential)).toBe(true)
    expect(plan.youNeedTo).toContain('Approve the Summit campaign message')
  })
  it('offers to break down a brand-new project', () => {
    const p = { ...db.projects[0], id: 'new', blocker: undefined, lastActivityAt: new Date().toISOString() }
    const plan = moveProjectForward(db, p)
    expect(plan.headline).toMatch(/getting started/)
    expect(plan.aiCanDo.some((a) => a.skill === 'break_down_project')).toBe(true)
  })
  it('reads a whole area', () => {
    const plan = moveAreaForward(db, 'area_summit')
    expect(plan.headline).toMatch(/Summit registration campaign/)
  })
})

describe('what next & opportunities', () => {
  it('explains each recommendation', () => {
    const recs = whatNext(db)
    expect(recs.length).toBeGreaterThan(0)
    expect(recs.length).toBeLessThanOrEqual(3)
    for (const r of recs) expect(r.why.length).toBeGreaterThan(10)
  })
  it('finds unsold finished work', () => {
    expect(monetizationScan(db).some((m) => m.assetId === 'as_summit_talks')).toBe(true)
  })
  it('gives the certification idea a reasoned verdict', () => {
    const r = evaluateIdea(db, db.ideas.find((i) => i.id === 'i_cert')!)
    expect(r.reasoning).toMatch(/already have/)
  })
  it('connects everything related to an area', () => {
    const groups = related(db, 'Build Your Ark')
    expect(groups.find((g) => g.label === 'Projects')?.items.length).toBeGreaterThan(0)
  })
})

describe('nursing school', () => {
  it('files nursing work in Nursing School, not DBM', () => {
    expect(classifyCapture('Study for pharmacology exam').areaId).toBe('area_nursing')
    expect(classifyCapture('Clinical shift Thursday at 6am').areaId).toBe('area_nursing')
    expect(classifyCapture('NCLEX practice questions').areaId).toBe('area_nursing')
    expect(classifyCapture('Study for pharmacology exam Friday').type).toBe('task')
  })
})
