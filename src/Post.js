/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Post class definition file.
 */

// import path from 'node:path'
// import fs from 'node:fs/promises'
import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _error as _Error,
} from './utils/debug.js'

const _log = Log.extend('post')
const _error = _Error.extend('post')
const POSTS = 'posts'
const MAX_SLUG_LENGTH = process.env.MAX_SLUG_LENGTH || 80

/**
 * A class to model the shape and properties of a single blog post.
 * @summary A class to model the shape and properties of a single blog post.
 * @class Post
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Post {
  #type = 'Post'

  #db

  #mongo

  #dbName

  #collection

  #redis

  #newPost

  #blogId

  #_id

  #title

  #slug

  #description

  #content

  #keywords

  #authors

  #createdOn

  #editedOn

  #images

  #public

  #postJson

  #temp

  #noop

  /**
   * Create an instance of a blog post.
   * @summary Create an instance of a blog post.
   * @author Matthew Duffy <mattdufffy@gmail.com>
   * @param { MongoClient|Collection } mongo - Either a mongodb client connection or its blog collection.
   * @param { Object } o - An object with post details to create instance.
   * @param { ObjectId } [o.id] - The ObjectId of the post in the db.
   * @param { String } [o.title] - The title of the post.
   * @param { String } [o.slug] - The url slug for the post.
   * @param { String } [o.description=null] - An optional text description of the post.
   * @param { String } [o.content] - The main text content of the post.
   * @param { String[] } [o.keywords=null] - An optinoal array of keywords for the post.
   * @param { String|String[] } [o.authors] - An author's name, or an array of more than one authors of the post.
   * @param { Object[] } [o.images=null] - An optional array of images linked in the post.
   * @param { Boolean } [o.newPost] - True if creating a new post, false otherwise.
   * @param { Boolean } [o.public] - True of false.
   * @param { Redis } redis - A redis client connection instance.
   * @return { Post } The populuated post instance.
   */
  constructor(mongo, o, redis) {
    // private properties
    const log = _log.extend('constructor')
    const error = _error.extend('constructor')
    this.#temp = o
    this.#newPost = o?.newPost ?? false
    this.#redis = redis ?? null
    // this.#mongo = o?.mongo ?? o?.db ?? null
    this.#mongo = mongo
    if ((!o?.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      // log('no collection provided: ', this.#mongo)
      log('no collection provided: ')
      this.#db = this.#mongo.collection(POSTS)
    } else if (o.collection?.collectionName !== undefined) {
      log('db.collection:', o.collection?.collectionName)
      this.#db = o.collection
    } else if (o.collection.collectionName !== POSTS) {
      this.#db = o.collection(POSTS)
    } else {
      this.#db = null
      error('config.dbName:     ', o.dbName)
      error('config.collection: ', o.collection)
      error('config.mongo:      ', o.mongo)
    }
    this.#newPost = !!o?.newPost
    // this.#_id = (!o?.id || !o._id) ? new ObjectId() : o?.id ?? o?._id
    this.#_id = o?._id ?? o?.id ?? new ObjectId()
    this.#blogId = o?.blogId ?? null
    this.#title = o?.title ?? o?.postTitle ?? null
    this.#slug = o?.slug ?? o?.postSlug ?? null
    this.#description = o?.description ?? o?.postDescription ?? null
    this.#content = o?.content ?? o?.postContent
    if (o?.keywords) {
      this.#keywords = new Set(o.keywords)
    } else if (o?.postKeywords) {
      this.#keywords = new Set(o.postKeywords)
    } else {
      this.#keywords = new Set()
    }
    if (o?.authors) {
      if (o?.authors?.constructor === String) {
        this.#authors = [o.authors]
      } else {
        this.#authors = o?.authors ?? null
      }
    } else if (o?.postAuthors) {
      if (o?.postAuthors?.constructor === String) {
        this.#authors = [o.postAuthors]
      } else {
        this.#authors = o?.postAuthors ?? null
      }
    }
    this.#images = o?.images ?? []
    this.#public = o?.public ?? false
  }

  /**
  */
  async init() {
    const log = _log.extend('init')
    const error = _error.extend('init')
    if (!this.#newPost) {
      let found
      try {
        const query = { _id: new ObjectId(this.#_id) }
        log(query)
        found = await this.#db.findOne(query)
        log(found)
        if (!this.#temp?.authors) {
          this.#authors = found.authors
        }
        if (!this.#temp?.createdOn) {
          this.#createdOn = found.createdOn
        }
        if (!this.#temp?.editedOn) {
          this.#editedOn = found.editedOn
        }
        if (!this.#temp?.images) {
          this.#images = found.images
        }
      } catch (e) {
        const msg = 'Failed to init post instance.'
        error(msg)
        throw new Error(msg, { cause: e })
      }
    }
    return this
  }

  /**
   * Save the post to db.
   * @summary Save the post to db.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Post|Boolean } - Return value of this, or false if save failed.
   */
  async save() {
    const log = _log.extend('save')
    const error = _error.extend('save')
    if (!this.#db) {
      const msg = `No connection to client collection ${POSTS}`
      error(msg)
      throw new Error(msg)
    }
    log(`is this a new post? ${this.#newPost}`)
    if (this.#newPost && !this.#_id) {
      this.#_id = new ObjectId()
      log('creating an new ObjectId _id..')
    }
    log(`the _id is ${this.#_id}`)
    if (this.#newPost) {
      this.#createdOn = new Date()
    } else {
      this.#editedOn = new Date()
    }
    if (!this.#postJson) {
      this.#postJson = this.createPostJson()
    }
    log('post json doc: ', this.#postJson)
    let saved
    let filter
    let options
    let update
    try {
      filter = { $and: [{ _id: new ObjectId(this.#_id) }, { blogId: new ObjectId(this.#blogId) }] }
      update = {
        $set: this.#postJson,
      }
      if (this.#newPost) {
        options = { upsert: true }
      } else {
        options = {}
        delete update.$set._id
      }
      log('save filter: ', filter)
      log('options:     ', options)
      log('save doc:    ', update)
      saved = await this.#db.updateOne(filter, update, options)
      log(saved)
    } catch (e) {
      const err = 'Failed to save/update post.'
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    log('updated and saved post: ', this)
    return this
  }

  /**
   * Create a json document with post details suitable for saving in db.
   * @summary Create a json document with post details suitable for saving in db.
   * @author Matthew Duffy <mattduffy@gmail.c>m>
   * @return { Object } JSON document with post details.
   */
  createPostJson() {
    const log = _log.extend('createPostJson')
    if (this.#postJson) return this.#postJson
    const tmp = {
      _id: new ObjectId(this.#_id),
      blogId: new ObjectId(this.#blogId),
      title: this.#title,
      slug: this.#slug,
      description: this.#description,
      content: this.#content,
      keywords: Array.from(this.#keywords),
      authors: this.#authors,
      images: this.#images,
      public: this.#public,
      createdOn: this.#createdOn,
      editedOn: this.#editedOn,
    }
    log(tmp)
    return tmp
  }

  set id(Id) {
    this.#_id = Id
  }

  get id() {
    return this.#_id
  }

  set title(t) {
    this.#title = t
  }

  get title() {
    return this.#title
  }

  set slug(t) {
    this.#slug = t
  }

  get slug() {
    return this.#slug
  }

  set url(t) {
    this.#slug = t
  }

  get url() {
    return this.#slug
  }

  set description(d) {
    this.#description = d
  }

  get description() {
    return this.#description
  }

  set desc(d) {
    this.#description = d
  }

  get desc() {
    return this.#description
  }

  set content(c) {
    this.#content = c
  }

  get content() {
    return this.#content
  }

  set keywords(k) {
    this.#keywords = new Set(k)
  }

  get keywords() {
    return Array.from(this.#keywords)
  }

  set keyword(k) {
    this.#keywords.add(k)
  }

  get images() {
    return this.#images
  }

  set image(i) {
    this.#images.push(i)
  }

  set public(p) {
    this.#public = p
  }

  get public() {
    return this.#public
  }

  get blogId() {
    return this.#blogId
  }

  get createdOn() {
    return this.#createdOn
  }

  get editedOn() {
    return this.#editedOn
  }

  get postJson() {
    return this.#postJson
  }

  get [Symbol.toStringTag]() {
    return this.#type
  }
}
export { Post }
