// Typography for a template.
//
// The text layer belongs to the skeleton, not to the page: a template's
// composition includes where its title, place line and caption sit, and the photo
// block is solved to fit around them. This turns the template's `fields` into the
// shape the canvas renders, so a second template gets its own text for free.

export function overviewTextFor(skeleton) {
  const fields = skeleton.fields || {}
  const body = fields.caption?.body || []
  return {
    title: fields.title?.content || '',
    subtitle: fields.subtitle?.content || '',
    place: fields.meta?.lines?.[0] || '',
    date: fields.meta?.lines?.[1] || '',
    captionLabel: fields.caption?.label || '',
    captionQuote: fields.caption?.quote || '',
    captionBody: Array.isArray(body) ? body : [body],
    signature: fields.sign?.content || '',
  }
}
