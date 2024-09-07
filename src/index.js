/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Blog class definition file.
 */

import { Blogs } from './Blogs.js'
import { Blog } from './Blog.js'
import { Post } from './Post.js'
import { slugify } from './utils/slugify.js'
// import { ObjectId } from '../lib/mongodb-client.js'
// import {
//   _log as Log,
//   _error as _Error,
// } from './utils/debug.js'

// const _log = Log.extend('Blog-index')
// const _error = _Error.extend('Blog-index')

export {
  slugify,
  Blog,
  Post,
  Blogs,
}
