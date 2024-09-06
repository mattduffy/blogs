/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/utils.js Useful functions to export.
 */

const MAX_SLUG_LENGTH = process.env.MAX_SLUG_LENGTH || 80

/**
 * Turn a text string into a valid url slug.
 * @summary Turn a text string into a valid url slug.
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @param { String } t - A string of text which may contain non-url compatible characters.
 * @return { String } A string with all punctuation chars removed and spaces collapsed into single - char.
 */
function slugify(t) {
  if (!t) return null
  return t.toLowerCase() // convert to lowercase letters
    .replace(/[^\p{Letter}\p{Number}\p{Separator}]/gv, ' ') // restrict by unicode character classes
    .replace(/\s+/g, '-') // collapse multiple spaces to single space and replace with dash
    .slice(0, MAX_SLUG_LENGTH) // truncate slug to global variable
}

export {
  slugify,
  MAX_SLUG_LENGTH,
}
