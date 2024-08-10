/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/Blog.js The Blog class definition file.
 */

import { Post } from './Post.js'
import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _error as _Error,
} from './utils/debug.js'

const _log = Log.extend('Blog')
const _error = _Error.extend('Blog')
const BLOGS = 'blogs'
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

/**
 * A class to model the shape and properties of a blog of posts.
 * @summary A class to model the shape and properties of a blog of posts.
 * @class Blog
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Blog {
  #type = 'Blog'

  #db

  #mongo

  #dbName

  #collection

  #redis

  #newBlog

  #blogId

  #blogUrl

  #blogHeaderImage

  #blogTitle

  #blogOwnerId

  #blogOwnerName

  #blogJson

  #blogKeywords

  #blogDescription

  #blogImages

  #blogPublic

  #posts

  /**
   * Create an instance of Blog.
   * @summary Create an instance of Blog.
   * @param { Object } config - An object literal containing configuration properties.
   * @param { Boolean } [config.newBlog = false] - True only if creating a new blog.
   * @param { Object } config.mongo - An instance of a mongoDB connection.
   * @param { string } config.dbName - A string with the db name if needed.
   * @param { Object } config.collection - A refernce to a mongoDB collection.
   * @param { Object } config.redis - An instance of a redis connection.
   * @param { string } config.blogId - A string of the unique blog id.
   * @param { string } config.blogUrl - Path portion of public url for the blog.
   * @param { string } config.blogHeaderImage - Path portion of the url to show blog preview image.
   * @param { string } config.blogTitle - The title of the blog.
   * @param { ObjectId|string } config.blogOwerId - The ObjectId value of the blog owner.
   * @param { string } config.blogOwerName - The name of the blog owner.
   * @param { string } config.blogKeywords - The keywords of the blog.
   * @param { string } config.blogDescription - The description of the blog.
   * @param { Object[] } config.blogImages - An array of JSON objects, each describing an image.
   * @param { Boolean } config.public - The visibilty status of the blog.
   * @return { Blog }
   */
  constructor(config = {}) {
    // private properties
    const log = _log.extend('constructor')
    const error = _error.extend('constructor')
    this.#newBlog = config?.newBlog ?? false
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? config?.db ?? null
    this.#dbName = config?.dbName ?? null
    if ((!config.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      log('no collection provided: ', this.#mongo)
      this.#db = this.#mongo.db(config.dbName).collection(BLOGS)
    } else if (config.collection?.collectionName !== undefined) {
      log('db.collection:', config.collection?.collectionName)
      this.#db = config.collection
    } else {
      this.#db = null
      error('config.dbName:     ', config.dbName)
      error('config.collection: ', config.collection)
      error('config.mongo:      ', config.mongo)
    }
    this.#blogId = config?.blogId ?? config.Id ?? config?.id ?? config?._id ?? null
    this.#blogHeaderImage = config.blogHeaderImage ?? config.headerImage ?? null
    this.#blogTitle = config?.blogTitle ?? config.title ?? null
    this.#blogUrl = config?.blogUrl ?? config?.url ?? config?.slug ?? slugify(this.#blogTitle) ?? null
    this.#blogOwnerId = config?.blogOwnerId ?? config.ownerId ?? config?.creatorId ?? null
    this.#blogOwnerName = config?.blogOwnerName ?? config.ownerName ?? config?.creatorName ?? null
    if (config?.blogKeywords) {
      this.#blogKeywords = new Set(config.blogKeywords)
    } else if (config?.keywords) {
      this.#blogKeywords = new Set(config.keywords)
    } else {
      this.#blogKeywords = new Set()
    }
    this.#blogDescription = config?.blogDescription ?? config?.description ?? null
    this.#blogImages = config?.blogImages ?? config?.images ?? []
    this.#posts = []
    // pseudo-protected properties
    this._blogPublic = config?.public ?? false
  }

  /**
   * Initialize the blog instance with an array of all post metadata.
   * @summary Initialize the blog instance with an array of all post metadata.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Blog }
   */
  async init() {
    const log = _log.extend('init')
    const error = _error.extend('init')
    // if (this.#blogOwnerId.constructor !== ObjectId) {
    //   this.#blogOwnerId = new ObjectId(this.#blogOwnerId)
    // }
    try {
      // this.#posts = Post.getAllPosts(this.#blogId, this.#db)
      const found = await this.#db.findOne({ _id: this.#blogId })
      log(found)
      this.#posts = found?.posts
      this._postCount = found.postCount
      log(`blogId ${this.#blogId} has ${this.#posts.length} post(s).`)
    } catch (e) {
      error(e)
    }
    return this
  }

  /**
   * Get <count> number of posts starting from post number <start>.
   * @summary Get <count> number of posts starting from post number <start>.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Number } [start = 0] - Return collection of posts starting with post number <start>.
   * @param { String|Number } [count = 'all'] - The max number of posts to return.
   * @return { Post|Post[] }
   */
  async posts(start = 0, count = 'all') {
    const log = _log.extend('posts')
    log(`get posts: start ${start}, count ${count}`)
    if (/all/i.test(count)) {
      return this.#posts
    }
    const c = parseInt(count, 10)
    const s = parseInt(start, 10)
    return this.#posts.slice(s, (s + c))
  }

  /**
   * Get range of public posts from <start> by <count>.
   * @summary Get range of public posts from <start> by <count>.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Number } s - The post to start from.
   * @param { Number|String } c - The number of posts to retrieve.
   * @param { String } [o='DESC'] - The sorting order to return posts in.
   * @param { String } [v='PUBLIC'] - The visibility of posts to retrieve [PUBLIC|PRIVATE|ALL].
   * @return { Post[]|Boolean } An array of posts or false.
   */
  async getPosts(s, c, o = 'DESC', v = 'PUBLIC') {
    const log = _log.extend('getPosts')
    const error = _error.extend('getPosts')
    const start = Number.parseInt(s, 10)
    let count
    if (c?.toLowerCase() === 'all') {
      count = 'all'
    } else {
      count = Number.parseInt(c, 10)
    }
    const order = o.toLowerCase()
    let visible
    if (v.toLowerCase() === 'public') {
      visible = true
    } else if (v.toLowerCase() === 'private') {
      visible = false
    } else {
      visible = undefined
    }
    log(`start: ${start}, count: ${count}, order: ${order}, public: ${visible}`)
    let posts
    let query
    const options = {}
    try {
      query = { blogId: new ObjectId(this.#blogId) }
      if (visible === true) {
        query.public = true
      } else if (visible === false) {
        query.public = false
      }
      options.sort = { _id: -1 }
      options.skip = { skip: start }
      if (count !== 'all') {
        options.limit = { limit: count }
      }
      log(query)
      log(options)
      posts = await this.#mongo.collection('posts').find(query, options).toArray()
      log(posts)
    } catch (e) {
      const msg = `Failed to retrieve posts from ${start} by ${count}, ordered ${order}`
      error(msg)
      error(e)
      return false
    }
    return posts
  }

  /**
   * Get the post corresponding to this id.
   * @summary Get the post corresponding to this id.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } id - The _id value for the post.
   * @throws { Error } Throw an error if id not provided.
   * @return { Post } The post with this id.
   */
  async getPost(id) {
    const log = _log.extend('getPost')
    const error = _error.extend('getPost')
    if (!id) {
      const msg = 'Missing required id parameter.'
      error(msg)
      throw new Error(msg)
    }
    let post
    let query
    try {
      query = { _id: new ObjectId(id), blogId: new ObjectId(this.#blogId) }
      // query = { _id: new ObjectId(id), blogId: this.#blogId }
      log(query)
      const found = await this.#mongo.collection('posts').findOne(query)
      log('found post: ', found)
      if (!found) {
        return false
      }
      post = new Post(this.#mongo, found)
      log(`found {${id}}, ${post.title}`)
    } catch (e) {
      const msg = `'Failed to retrieve post {id: ${id}}`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    return post
  }

  /**
   * Delete the blog.
   * @summary Delete the blog.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Booloean } - True if blog is successfully deleted.
   */
  async deleteBlog() {
    const log = _log.extend('deleteBlog')
    const error = _error.extend('deleteBlog')
    log(`About to delete blog: ${this.#blogTitle}`)
    let deleted
    try {
      const filter = { _id: new ObjectId(this.#blogId) }
      const response = await this.#db.deleteOne(filter)
      if (response.deletedCount !== 1) {
        deleted = false
      }
    } catch (e) {
      error(`failed to remove blogId ${this.#blogId} from db.`)
      error(e)
      deleted = false
    }
    return (deleted === undefined)
  }

  /**
   * Save blog json to db.
   * @summary Save blog json to db.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws { Error } If no db collection is available.
   * @return { ObjectId|Boolean } Return the new monogdb objectId if successfully saved to db, otherwise false.
   */
  async save() {
    const log = _log.extend('save')
    const error = _error.extend('save')
    if (!this.#db) {
      const msg = `No connection to client collection ${BLOGS}`
      throw new Error(msg)
    }
    log(this.#newBlog)
    if (this.#newBlog) {
      this.#blogId = new ObjectId()
      log('creating an new ObjectId _id..')
    // } else {
    //   this.#blogId = new ObjectId(this.#blogId)
    }
    log(`the _id is ${this.#blogId}`)
    if (!this.#blogJson) {
      this.#blogJson = await this.createBlogJson()
    }
    log(this.#blogJson)
    let saved
    let filter
    if (!this.#blogUrl) {
      this.#blogUrl = slugify(this.#blogTitle)
      this.url = this.#blogUrl
    }
    // try {
    //   if (this._albumPublic) {
    //     const add = await this.addToRedisStream()
    //     log(`blog id: ${theId} was added to the redis recent10 stream?`, add)
    //   } else {
    //     log(`blog id: ${theId}, streamId: ${this.#streamId}`)
    //     const remove = await this.removeFromRedisStream()
    //     log(`blog id: ${theId} was removed from the redis recent10 stream.`, remove)
    //   }
    // } catch (e) {
    //   saved.redis = { msg: 'Failed to add new blog to redis stream.', e }
    //   error(e)
    // }
    try {
      filter = { _id: this.#blogId }
      const options = { upsert: true }
      log('save filter: %o', filter)
      log('replace doc: %o', this.#blogJson)
      const update = {
        $set: {
          _id: new ObjectId(this.#blogId),
          streamId: null, // this.#streamId,
          headerImageUrl: this.#blogHeaderImage,
          creatorId: this.#blogOwnerId,
          creatorName: this.#blogOwnerName,
          title: this.#blogTitle,
          url: this.#blogUrl,
          description: this.#blogDescription,
          keywords: Array.from(this.#blogKeywords),
          public: this._blogPublic,
          postCount: this.#posts.length,
        },
      }
      if (this.#newBlog) {
        update.$set.createdOn = new Date()
      } else {
        update.$set.modifiedOn = new Date()
      }
      log('the update doc: %o', update)
      saved = await this.#db.updateOne(filter, update, options)
      saved.insertedId = this.#blogId
      log('Blog save results: %o', saved)
    } catch (e) {
      const err = 'Failed to save blog json to db.'
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    // modifiedCount, upsertedCount, upsertedId
    // if (!saved?.insertedId || saved?.upsertedCount < 1 || saved?.modifiedCount < 1) {
    if (saved?.modifiedCount < 1 && saved?.upsertedCount < 1 && saved?.matchedCount < 1) {
      return false
    }
    if (!this.#blogId) {
      this.#blogId = saved.insertedId.toString()
    }
    return saved
  }

  /**
   * Build the JSON object for the album.
   * @summary Build the JSON object for the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws Error
   * @return { Object }
   */
  async createBlogJson() {
    return {
      _id: this.#blogId,
      headerImageUrl: this.#blogHeaderImage,
      creator: this.#blogOwnerId,
      title: this.#blogTitle,
      url: this.#blogUrl,
      description: this.#blogDescription,
      keywords: Array.from(this.#blogKeywords),
      public: this._blogPublic,
    }
  }

  /**
   * Update the blog post from the submitted details.
   * @summary Update the blog post from the submitted details.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Object }
   * @return { Post|Boolean }
   */
  async updatePost(p) {
    const log = _log.extend('updatePost')
    const error = _error.extend('upatePost')
    const o = {
      dbName: this.#dbName,
      blogId: this.#blogId,
      ...p,
    }
    log(`updating post {_id:${p._id}} with: `, o)
    let post
    try {
      post = await new Post(this.#mongo, o).init()
      log('updating post instance: ', post.id)
      log(post)
      post = await post.save()
      const update = {
        id: new ObjectId(post.id),
        title: post.title,
        slug: post.slug,
        createdOn: post.createdOn,
        editedOn: post.editedOn,
        public: post.public,
      }
      await this.#updatePostArray(update)
      await this.save()
      log('post saved: ', post.title, post.editedOn)
      if (!post) {
        error('failed to create post.')
        return false
      }
    } catch (e) {
      const msg = 'Failed to update post.'
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    log('blog post edited: ', post.id)
    return post
  }

  /**
   * Create a new blog post from the submitted details.
   * @summary Create a new blog post from the submitted details.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Object }
   * @return { Post|Boolean }
   */
  async createPost(p) {
    const log = _log.extend('createPost')
    const error = _error.extend('createPost')
    const o = {
      newPost: true,
      dbName: this.#dbName,
      blogId: this.#blogId,
      ...p,
    }
    log('creating new post with: ', o)
    let post
    try {
      // log(this.#mongo)
      post = new Post(this.#mongo, o)
      log('new post instance: ', post.id)
      log(post)
      post = await post.save()
      log('new post saved: ', post.title)
      // await this.#updatePostArray(post.id, post.title, post.slug, post.createdOn, post.public)
      const update = {
        id: post.id,
        title: post.title,
        slug: post.slug,
        createdOn: post.createdOn,
        public: post.public,
      }
      await this.#updatePostArray(update)
      if (!post) {
        error('failed to create post.')
        return false
      }
    } catch (e) {
      error(e)
      return false
    }
    log('blog post created: ', post.id)
    return post
  }

  /**
   * Update the private post array with new post details.
   * @summary Update the private post array with new post details.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @param { Object } u - New post details for post array.
   * @return { undefined }
   */
  async #updatePostArray(u) {
    const log = _log.extend('updatePostArray')
    const error = _error.extend('updatePostArray')
    log('updating the post array with: ', u)
    const found = this.#posts.findIndex((p) => u.id.equals(p.id))
    if (found < 0) {
      this.#posts.push(u)
    } else {
      this.#posts[found].title = u.title
      this.#posts[found].slug = u.slug
      this.#posts[found].createdOn = u.createdOn
      this.#posts[found].editedOn = u.editedOn
      this.#posts[found].public = u.public
    }
    try {
      const filter = { _id: this.#blogId }
      const update = {
        $set: {
          posts: this.#posts,
          postCount: this.#posts.length,
        },
      }
      await this.#db.updateOne(filter, update)
    } catch (e) {
      const msg = 'Failed to update post array'
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
  }

  set redisClient(client) {
    this.#redis = client
  }

  set mongoClient(client) {
    this.#mongo = client
  }

  addKeyword(word) {
    return Array.from(this.#blogKeywords.add(word))
  }

  removeKeyword(word) {
    return this.#blogKeywords.delete(word)
  }

  get id() {
    if (this.#blogId) {
      return this.#blogId
    }
    return undefined
  }

  set id(id) {
    this.#blogId = id
  }

  get slug() {
    return this.#blogUrl
  }

  get url() {
    return this.#blogUrl
  }

  set url(url) {
    const log = _log.extend('set-url')
    this.#blogUrl = slugify(url)
    this._slug = this.url
    log(`set url(${url}) : ${this.#blogUrl}`)
  }

  get title() {
    return this.#blogTitle
  }

  set title(title) {
    this.#blogTitle = title
  }

  get ownerId() {
    return this.#blogOwnerId.toString()
  }

  set ownerId(id) {
    if (id.constructor !== ObjectId) {
      this.#blogOwnerId = new ObjectId(id)
    } else {
      this.#blogOwnerId = id
    }
  }

  get author() {
    return this.#blogOwnerName
  }

  set author(name) {
    this.#blogOwnerName = name
  }

  get ownerName() {
    return this.#blogOwnerName
  }

  set ownerName(name) {
    this.#blogOwnerName = name
  }

  set description(desc) {
    this.#blogDescription = desc
  }

  get description() {
    return this.#blogDescription
  }

  set keywords(words) {
    // console.log(words)
    words.forEach((word) => {
      this.#blogKeywords.add(word)
    })
  }

  get keywords() {
    console.log(this.#blogKeywords)
    return Array.from(this.#blogKeywords)
  }

  get public() {
    return this._blogPublic
  }

  set public(isPublic = false) {
    this._blogPublic = isPublic
  }

  async getJson() {
    if (this.#blogJson) {
      return this.#blogJson
    }
    return this.createBlogJson()
  }

  get json() {
    this._null = null
    _error('no-op: get json()')
    return undefined
  }

  set json(j) {
    this._null = null
    _error('no-op: set json()')
  }

  get [Symbol.toStringTag]() {
    return this.#type
  }
}

export {
  Blog,
  slugify,
}
