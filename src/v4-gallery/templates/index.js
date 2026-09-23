// Template registry.
//
// The page never imports a template directly; it asks for one by id, so switching
// the active template is a data change rather than a code change.

import fullBleedCollage from './fullBleedCollage.js'
import photoStrip from './photoStrip.js'
import todayMoment from './todayMoment.js'
import { validateSkeleton } from '../layout/skeleton.js'

const REGISTRY = {
  [todayMoment.id]: todayMoment,
  [photoStrip.id]: photoStrip,
  [fullBleedCollage.id]: fullBleedCollage,
}

export const DEFAULT_TEMPLATE_ID = todayMoment.id

export function getTemplate(id) {
  const skeleton = REGISTRY[id]
  if (!skeleton) throw new Error(`未知模板 "${id}"。已注册：${Object.keys(REGISTRY).join(', ')}`)
  return skeleton
}

export function allTemplates() {
  return Object.values(REGISTRY)
}

// A template is data, so it can be checked cheaply and loudly. Catching a typo
// here beats shipping a silently wrong layout.
export function validateAllTemplates() {
  const problems = []
  for (const skeleton of allTemplates()) {
    for (const problem of validateSkeleton(skeleton)) {
      problems.push(`${skeleton.id}: ${problem}`)
    }
  }
  return problems
}
